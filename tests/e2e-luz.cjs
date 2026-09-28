// Prueba end-to-end del analizador de consumo eléctrico (Chromium + Playwright).
//   npm i --no-save playwright && node build.mjs && node tests/e2e-luz.cjs
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { serve, newContext, checker } = require("./lib.cjs");

const OUT = process.env.SHOTS || path.join(__dirname, "..", "test-results");

// CSV CNMC de 14 días: 1 kWh cada hora en punta los laborables, 0,2 kWh el resto → reparto conocido.
function makeCsv() {
  const lines = ["CUPS;Fecha;Hora;Consumo_kWh;Metodo_obtencion"];
  const start = Date.UTC(2026, 8, 7); // lunes 07/09/2026
  for (let d = 0; d < 14; d++) {
    const dt = new Date(start + d * 86400000);
    const dd = String(dt.getUTCDate()).padStart(2, "0"), mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const weekend = [0, 6].includes(dt.getUTCDay());
    for (let h = 1; h <= 24; h++) {
      const s = h - 1;
      const punta = !weekend && ((s >= 10 && s < 14) || (s >= 18 && s < 22));
      lines.push(`ES0021000000000000AB0F;${dd}/${mm}/2026;${h};${punta ? "1,000" : "0,200"};R`);
    }
  }
  return lines.join("\n") + "\n";
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch();
  const { check, failures } = checker();

  const { ctx, external } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(srv.base + "/luz/");
  check((await page.title()).includes("tarifa de luz"), "Portada de luz con título SEO");
  check(await page.locator("#results").isHidden(), "Sin resultados hasta cargar datos");

  // 1. Ejemplo sin CSV
  await page.click("#example-btn");
  await page.waitForSelector("#results:not([hidden])");
  check(/Ejemplo/.test(await page.textContent("#status-text")), "El ejemplo carga un hogar tipo");
  check((await page.locator("#ranking tbody tr").count()) === 2, "Ranking con las 2 ofertas de ejemplo");
  check((await page.locator("#monthly .bar").count()) === 12, "12 barras mensuales en el ejemplo de un año");
  check((await page.locator("#heat .cell").count()) === 168, "Mapa de calor de 7×24 celdas");
  await page.screenshot({ path: path.join(OUT, "luz-ejemplo.png"), fullPage: true });

  // 2. CSV real con reparto conocido
  const csv = makeCsv();
  await page.setInputFiles("#file-input", { name: "consumo.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.waitForFunction(() => /336 horas/.test(document.getElementById("status-text").textContent));
  const status = await page.textContent("#status-text");
  check(/07\/09\/2026 al 20\/09\/2026/.test(status), "Lee las fechas del CSV: " + status.split("(")[0].trim());
  check(/ES00…AB0F/.test(status) && !status.includes("ES0021000000000000AB0F"), "Muestra el CUPS enmascarado");
  check(/extrapolación/.test(status), "Avisa de que 14 días son pocos para el cálculo anual");
  // 10 laborables × 8 h punta × 1 kWh = 80 kWh; resto 336−80 = 256 h × 0,2 = 51,2 kWh → total 131,2 kWh
  const kpi = await page.textContent("#kpis");
  check(kpi.includes("131 kWh"), "Consumo total correcto (131 kWh)");
  check(/Punta 61 %/.test(kpi), "Reparto por periodos correcto (punta 61 %): " + kpi.match(/Punta \d+ %/)?.[0]);
  // Con tanto consumo en punta, la oferta de precio fijo debe ganar a la de 3 periodos.
  const first = await page.textContent("#ranking tbody tr:first-child td:nth-child(2)");
  check(/Precio fijo/.test(first), "Con mucho consumo en punta gana el precio fijo: " + first);

  // 3. Editar precios cambia el ganador
  const valle = page.locator('fieldset.offer').nth(1).locator('input[data-key="energy"]').nth(0);
  await valle.fill("0.05");
  await valle.dispatchEvent("change");
  const first2 = await page.textContent("#ranking tbody tr:first-child td:nth-child(2)");
  check(/3 periodos/.test(first2), "Si la punta de la oferta por periodos baja a 0,05 €, pasa a ser la más barata");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tl.luz.offers"))[1].energy[0]);
  check(saved === 0.05, "Las ofertas se guardan en el navegador");

  // 4. Añadir y quitar ofertas; cambiar potencia
  await page.click("#add-offer");
  check((await page.locator("#ranking tbody tr").count()) === 3, "Añadir una oferta la incluye en el ranking");
  await page.locator(".offer .remove").last().click();
  check((await page.locator("#ranking tbody tr").count()) === 2, "Quitar una oferta la saca del ranking");
  const before = await page.textContent("#ranking tbody tr:first-child td:nth-child(4)");
  await page.fill("#pw1", "3.45");
  const after = await page.textContent("#ranking tbody tr:first-child td:nth-child(4)");
  check(before !== after, `Bajar la potencia abarata el coste anual (${before} → ${after})`);

  // 5. Simulador de mover consumo a valle
  const r0 = await page.textContent(".insight-result");
  await page.fill("#shift", "50");
  await page.dispatchEvent("#shift", "input");
  const r1 = await page.textContent(".insight-result");
  check(/no ahorrarías/.test(r1), "Si el valle no es más barato, no promete un ahorro negativo: " + r1);
  await valle.fill("0.19");
  await valle.dispatchEvent("change");
  await page.fill("#shift", "50");
  await page.dispatchEvent("#shift", "input");
  const r2 = await page.textContent(".insight-result");
  check(/ahorrarías \d/.test(r2) && r2 !== r0, "Con punta cara, mover consumo a valle da un ahorro positivo: " + r2);

  // 6. Tooltip del gráfico
  await page.hover("#monthly .bar .hit");
  check(!(await page.locator("#tip").isHidden()) && /kWh/.test(await page.textContent("#tip")), "Tooltip al pasar por una barra");

  // 7. Fichero no válido
  await page.setInputFiles("#file-input", { name: "otra.csv", mimeType: "text/csv", buffer: Buffer.from("nombre;apellido\nana;pérez\n") });
  await page.waitForSelector('#status[data-kind="error"]');
  check(/No hemos podido leer/.test(await page.textContent("#status-text")), "Un CSV que no es de consumo muestra un error claro");
  check(external.length === 0, "No se hace ninguna petición a terceros (el CSV no sale del navegador)" + (external.length ? ": " + external.join(", ") : ""));
  check(errors.length === 0, "Sin errores en la consola" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();

  // 8. Móvil y páginas
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const p of ["/luz/", "/luz/descargar-consumo-datadis.html", "/luz/potencia-contratada.html"]) {
      await page.goto(srv.base + p);
      await page.click("#example-btn");
      await page.waitForSelector("#results:not([hidden])");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `Móvil ${p} con resultados: sin scroll horizontal (${overflow}px)`);
    }
    await page.screenshot({ path: path.join(OUT, "luz-movil.png"), fullPage: true });
    await ctx.close();
  }

  // 9. Modo oscuro
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
    const page = await ctx.newPage();
    await page.goto(srv.base + "/luz/");
    await page.click("#example-btn");
    await page.waitForSelector("#results:not([hidden])");
    const fill = await page.evaluate(() => getComputedStyle(document.querySelector(".seg-P1")).fill);
    check(fill === "rgb(57, 135, 229)", "En modo oscuro las series usan los tonos oscuros validados: " + fill);
    await page.screenshot({ path: path.join(OUT, "luz-oscuro.png"), fullPage: false });
    await ctx.close();
  }

  await browser.close();
  srv.server.close();
  check(srv.outside.length === 0, "Ninguna petición fuera de la ruta base");
  console.log(failures() ? `\n${failures()} prueba(s) fallida(s)` : "\nTodas las pruebas de luz han pasado.");
  process.exit(failures() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
