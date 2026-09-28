// Prueba end-to-end del comparador de tarifas de luz (Chromium + Playwright).
//   npm i --no-save playwright && node build.mjs && node tests/e2e-luz.cjs
// Se sirve un data/pvpc.json sintético (los precios reales los descarga Actions a diario).
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
  const { summarizePvpc } = await import("../assets/js/luz/pvpc.js");
  const { periodOf } = await import("../assets/js/luz/core.js");
  // PVPC sintético de 13 meses: punta 0,22, llano 0,15, valle 0,09 €/kWh.
  const days = {};
  const today = new Date();
  for (let d = -400; d <= 2; d++) { // +2: de noche la fecha de Madrid ya va un día por delante de la UTC
    const date = new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);
    days[date] = Array.from({ length: 24 }, (_, h) => ({ P1: 0.22, P2: 0.15, P3: 0.09 })[periodOf(date, h)]);
  }
  const pvpcJson = JSON.stringify(summarizePvpc(days, today.toISOString()));

  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch();
  const { check, failures } = checker();
  const withPvpc = { [srv.base + "/data/pvpc.json"]: pvpcJson };
  const nCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "ofertas.json"), "utf8")).offers.length;

  const { ctx, external } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, withPvpc);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(srv.base + "/luz/");
  check((await page.title()).includes("tarifa de luz"), "Portada de luz con título SEO");
  check(await page.locator("#results").isHidden() && await page.locator("#headline").isHidden(), "Sin resultados hasta cargar datos");

  // 1. Ejemplo en 1 clic: resultado principal sin escribir precios
  await page.click("#example-btn");
  await page.waitForSelector("#headline:not([hidden]) .headline-name");
  const bestName = await page.textContent(".headline-name");
  check(bestName.length > 3, "Resultado principal en 1 clic: " + bestName);
  check((await page.locator("#ranking tbody tr").count()) === nCatalog + 1, `Ranking con PVPC + ${nCatalog} tarifas del catálogo`);
  check(await page.locator("#ranking tbody tr", { hasText: "PVPC" }).count() === 1, "El PVPC aparece en el ranking");
  check(/Precio real hora a hora/.test(await page.textContent("#ranking")), "El PVPC se calcula hora a hora con el consumo");
  check(/verificados el 28\/09\/2026/.test(await page.textContent("#verified-note")), "Se indica la fecha de verificación de los precios");
  check([12, 13].includes(await page.locator("#monthly .bar").count()) && (await page.locator("#heat .cell").count()) === 168, "Gráficos del ejemplo");
  await page.screenshot({ path: path.join(OUT, "luz-resultado.png"), fullPage: false });
  const years = await page.evaluate(() => window.__luz.ranking().map((x) => x.total));
  check(years.every((v, i) => i === 0 || v >= years[i - 1]), "La lista está ordenada por precio (de menor a mayor)");
  check(await page.locator("#sponsored").isHidden() && (await page.locator(".sponsored-tag").count()) === 0, "Sin patrocinios activados no se marca nada como patrocinado");
  check(/Cómo ganamos dinero/.test(await page.textContent("#sort-note")), "Nota de orden por precio con enlace a «Cómo ganamos dinero»");
  check(await page.locator("#solar").isVisible(), "Placas solares: el bloque aparece tras analizar el consumo");
  const saving = await page.textContent("#solar-saving");
  check(/Ahorro orientativo: [\d.]+(,\d+)?\s€/.test(saving) && /se pagarían en unos \d/.test(await page.textContent("#solar-result")), "Placas solares: ahorro y años de retorno (" + saving.trim() + ")");
  check(/recomendada/.test(await page.locator("#solar-size option:checked").textContent()), "Placas solares: propone un tamaño recomendado");
  await page.selectOption("#solar-size", "8");
  check(saving !== (await page.textContent("#solar-saving")), "Placas solares: cambiar el tamaño recalcula");
  await page.selectOption("#solar-zone", "sur");
  check((await page.evaluate(() => JSON.parse(localStorage.getItem("tl.luz.solarZone")))) === "sur", "Placas solares: la zona se recuerda");

  // 2. Tarifa actual → ahorro concreto
  const worst = await page.textContent("#ranking tbody tr:last-child td:nth-child(2)");
  const worstId = await page.evaluate((txt) => [...document.querySelectorAll("#current option")].find((o) => txt.startsWith(o.textContent))?.value, worst);
  await page.selectOption("#current", worstId);
  const msg = await page.textContent(".headline-msg");
  check(/Ahorras ~\d/.test(msg), "Con la tarifa actual elegida, dice cuánto ahorras: " + msg.trim());
  check((await page.evaluate(() => JSON.parse(localStorage.getItem("tl.luz.current")))) === worstId, "La tarifa actual se recuerda");
  const bestId = await page.evaluate(() => window.__luz.ranking()[0].offer.id);
  await page.selectOption("#current", bestId);
  check(/Ya tienes la tarifa más barata/.test(await page.textContent(".headline-msg")), "Si ya tienes la mejor, lo dice");
  check((await page.locator(".headline a.btn").count()) === 1 || bestId === "pvpc", "Enlace a la web oficial de la mejor tarifa");

  // 3. CSV real con reparto conocido
  await page.setInputFiles("#file-input", { name: "consumo.csv", mimeType: "text/csv", buffer: Buffer.from(makeCsv()) });
  await page.waitForFunction(() => /336 horas/.test(document.getElementById("status-text").textContent));
  const status = await page.textContent("#status-text");
  check(/07\/09\/2026 al 20\/09\/2026/.test(status) && /ES00…AB0F/.test(status), "Lee fechas y enmascara el CUPS");
  const kpi = await page.textContent("#kpis");
  check(kpi.includes("131 kWh") && /Punta 61 %/.test(kpi), "Consumo total (131 kWh) y reparto (punta 61 %) correctos");
  // Con 61 % en punta, la tarifa por periodos del catálogo no debería ganar.
  const winner = await page.evaluate(() => window.__luz.ranking()[0].offer);
  check(winner.type !== "periods", "Con mucho consumo en punta no gana una tarifa por periodos: " + winner.name);

  // 4. Mi tarifa: una muy barata pasa a ser la mejor
  await page.click("#setup summary");
  await page.click("#add-offer");
  const e0 = page.locator('.offer input[data-key="energy"]').first();
  await e0.fill("0.03");
  await e0.dispatchEvent("change");
  check(/Mi tarifa 1/.test(await page.textContent(".headline-name")), "Una tarifa propia más barata pasa a ser la mejor opción");
  check((await page.evaluate(() => JSON.parse(localStorage.getItem("tl.luz.offers")).length)) === 1, "Las tarifas propias se guardan");
  await page.locator(".offer .remove").click();
  check(!/Mi tarifa/.test(await page.textContent("#ranking")), "Quitar la tarifa propia la saca del ranking");
  const y0 = await page.textContent("#ranking tbody tr:first-child td:nth-child(3)");
  await page.fill("#pw1", "3.45");
  check(y0 !== (await page.textContent("#ranking tbody tr:first-child td:nth-child(3)")), "Bajar la potencia cambia el coste anual");

  // 5. Simulador y tooltip
  await page.fill("#shift", "50");
  await page.dispatchEvent("#shift", "input");
  check(/ahorrarías \d|no ahorrarías/.test(await page.textContent(".insight-result")), "Simulador de mover consumo a valle");
  await page.hover("#monthly .bar .hit");
  check(/kWh/.test(await page.textContent("#tip")), "Tooltip al pasar por una barra");

  // 6. Cálculo rápido sin CSV
  await page.click("#quick summary");
  await page.fill("#q-kwh", "300");
  await page.fill("#q-valle", "60");
  await page.dispatchEvent("#q-valle", "input");
  await page.click("#quick-form button[type=submit]");
  await page.waitForFunction(() => /Cálculo rápido/.test(document.getElementById("status-text").textContent));
  check(await page.locator("#charts").isHidden() && await page.locator("#consumption").isHidden(), "En el cálculo rápido no se muestran gráficos horarios");
  check(await page.locator("#solar").isHidden(), "Placas solares: sin consumo horario (cálculo rápido) no se estima");
  check(/Media del último año/.test(await page.textContent("#ranking")), "En el cálculo rápido el PVPC usa la media por periodo");
  const quickPeriodsWins = await page.evaluate(() => window.__luz.ranking().findIndex((x) => x.offer.type === "periods"));
  check(quickPeriodsWins >= 0, "La tarifa por periodos entra en el ranking rápido (posición " + (quickPeriodsWins + 1) + ")");

  // 7. Fichero no válido
  await page.setInputFiles("#file-input", { name: "otra.csv", mimeType: "text/csv", buffer: Buffer.from("nombre;apellido\nana;pérez\n") });
  await page.waitForSelector('#status[data-kind="error"]');
  check(/No hemos podido leer/.test(await page.textContent("#status-text")), "Un CSV que no es de consumo muestra un error claro");
  check(external.length === 0, "Ninguna petición a terceros: el CSV no sale del navegador" + (external.length ? ": " + external.join(", ") : ""));
  check(errors.length === 0, "Sin errores en la consola" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();

  // 7b. Oferta patrocinada (activada solo en esta prueba): marcada, con enlace patrocinado y SIN cambiar de puesto
  {
    const cat = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "ofertas.json"), "utf8"));
    cat.sponsoredEnabled = true;
    const sp = cat.offers.at(-1);
    sp.sponsored = true;
    sp.affiliateUrl = "https://example.com/afiliado";
    const { ctx, external } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, { ...withPvpc, [srv.base + "/data/ofertas.json"]: JSON.stringify(cat) });
    const page = await ctx.newPage();
    await page.goto(srv.base + "/luz/");
    await page.click("#example-btn");
    await page.waitForSelector("#headline:not([hidden]) .headline-name");
    const order = await page.evaluate(() => window.__luz.ranking().map((x) => x.total));
    check(order.every((v, i) => i === 0 || v >= order[i - 1]), "Patrocinado: la lista sigue ordenada por precio");
    const row = page.locator("#ranking tbody tr", { hasText: "Patrocinado" });
    check((await row.count()) === 1, "Patrocinado: la tarifa aparece marcada una sola vez en la lista");
    check((await row.locator("a[rel='sponsored nofollow noopener']").getAttribute("href")) === "https://example.com/afiliado", "Patrocinado: enlace con rel=sponsored");
    check(await page.locator("#sponsored").isVisible() && /Puesto \d+ de \d+ por precio/.test(await page.textContent("#sponsored")), "Patrocinado: hueco propio con su puesto real por precio");
    check(external.length === 0, "Patrocinado: no se hace ninguna petición a terceros");
    await ctx.close();
  }

  // 8. Sin datos del PVPC (p. ej. REE caído): funciona con el catálogo y lo avisa
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(srv.base + "/luz/");
    await page.click("#example-btn");
    await page.waitForSelector("#headline:not([hidden]) .headline-name");
    check((await page.locator("#ranking tbody tr").count()) === nCatalog, "Sin pvpc.json compara solo el catálogo");
    check(/Sin datos del PVPC/.test(await page.textContent("#verified-note")), "…y lo indica");
    await ctx.close();
  }

  // 8b. Precio de la luz hoy
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, withPvpc);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(srv.base + "/luz/precio-luz-hoy.html");
    await page.waitForSelector("#hoy .day .chart-svg");
    const days = await page.locator("#hoy .day").count();
    check(days === 2, "Precio de hoy: muestra hoy y mañana (" + days + " días)");
    check((await page.locator("#hoy .day").first().locator(".bar").count()) === 24, "24 barras horarias");
    check((await page.locator("#hoy .day").first().locator("path.seg-P3").count()) === 3, "Las 3 horas más baratas destacadas");
    check(/Hora más barata/.test(await page.textContent("#hoy")) && /€\/kWh/.test(await page.textContent("#hoy")), "Resumen con la hora más barata y precios");
    check(/Datos de Red Eléctrica actualizados/.test(await page.textContent("#hoy-updated")), "Indica la fecha de actualización de los datos");
    check(errs.length === 0, "Sin errores en la página de precio de hoy");
    await page.screenshot({ path: path.join(OUT, "luz-hoy.png"), fullPage: false });
    await ctx.close();
    const { ctx: c2 } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } });
    const p2 = await c2.newPage();
    await p2.goto(srv.base + "/luz/precio-luz-hoy.html");
    await p2.waitForSelector(".hoy-empty:not([hidden])");
    check(true, "Sin datos del PVPC muestra un aviso en lugar de romperse");
    await c2.close();
  }

  // 8c. Calculadora de electrodomésticos
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, withPvpc);
    const page = await ctx.newPage();
    await page.goto(srv.base + "/luz/cuanto-gasta-electrodomestico.html");
    await page.waitForFunction(() => document.querySelectorAll("#g-result .kpi").length === 3);
    check(/medio del PVPC/.test(await page.textContent("#g-p-src")), "El precio por defecto es la media real del PVPC");
    await page.selectOption("#g-app", { label: "Radiador o estufa eléctrica" });
    await page.fill("#g-p", "0.15");
    const day = await page.textContent("#g-result .kpi:first-child");
    // 1,5 kW × 4 h = 6 kWh × 0,15 € × impuestos (1,0511 × 1,21) ≈ 1,14 €
    check(/6 kWh/.test(day) && /1,14/.test(day), "Radiador 1.500 W × 4 h = 6 kWh ≈ 1,14 € al día con impuestos: " + day.replace(/\s+/g, " "));
    await ctx.close();
  }

  // 9. Móvil y modo oscuro
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, withPvpc);
    const page = await ctx.newPage();
    for (const p of ["/luz/", "/luz/descargar-consumo-datadis.html", "/luz/potencia-contratada.html", "/luz/pvpc-o-mercado-libre.html"]) {
      await page.goto(srv.base + p);
      await page.click("#example-btn");
      await page.waitForSelector("#headline:not([hidden]) .headline-name");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `Móvil ${p} con resultados: sin scroll horizontal (${overflow}px)`);
    }
    await page.screenshot({ path: path.join(OUT, "luz-movil.png"), fullPage: false });
    await ctx.close();
  }
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 }, colorScheme: "dark" }, withPvpc);
    const page = await ctx.newPage();
    await page.goto(srv.base + "/luz/");
    await page.click("#example-btn");
    await page.waitForSelector("#results:not([hidden])");
    const fill = await page.evaluate(() => getComputedStyle(document.querySelector(".seg-P1")).fill);
    check(fill === "rgb(57, 135, 229)", "En modo oscuro las series usan los tonos oscuros validados");
    await ctx.close();
  }

  await browser.close();
  srv.server.close();
  check(srv.outside.length === 0, "Ninguna petición fuera de la ruta base");
  console.log(failures() ? `\n${failures()} prueba(s) fallida(s)` : "\nTodas las pruebas de luz han pasado.");
  process.exit(failures() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
