// Genera la web estática en _site/ a partir de src/ y assets/.
// Sin dependencias: `node build.mjs`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { STRINGS, AUDIO_LANGUAGES } from "./assets/js/i18n.js";
import { STRINGS as CAPTIONS_STRINGS } from "./assets/js/captions/i18n.js";
import { STRINGS as LUZ_STRINGS } from "./assets/js/luz/i18n.js";
import { dayStats } from "./assets/js/luz/pvpc.js";
import { madridDate } from "./assets/js/luz/hoy.js";
import { RULES } from "./assets/js/luz/core.js";
import { computeStudy, studyCSV } from "./assets/js/luz/estudio.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
// SITE_OUT y ADS_CONFIG solo se usan en las pruebas (generar en otra carpeta y con otra configuración de anuncios).
const OUT = process.env.SITE_OUT || join(ROOT, "_site");
const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
// URL pública = origen + ruta base. La ruta base permite publicar en una subcarpeta
// (p. ej. usuario.github.io/game/) o en la raíz de un dominio propio ("/").
// Solo se usa para URLs absolutas (canonical, hreflang, sitemap, Open Graph, 404);
// los enlaces internos, CSS, JS y el worker usan siempre rutas relativas.
const siteOrigin = (process.env.SITE_ORIGIN || site.siteOrigin).replace(/\/+$/, "");
const basePath = ("/" + (process.env.BASE_PATH || site.basePath || "/") + "/").replace(/\/{2,}/g, "/");
if (!/^https?:\/\/[^/]+$/.test(siteOrigin)) throw new Error(`siteOrigin no válido: "${siteOrigin}" (ej.: https://usuario.github.io)`);
const siteUrl = siteOrigin + basePath.replace(/\/$/, "");

// Lee config.js (el mismo archivo que usa el navegador) para generar ads.txt.
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(process.env.ADS_CONFIG || join(ROOT, "assets/js/config.js"), "utf8"), sandbox);
const adsCfg = sandbox.window.SITE_CONFIG || {};

// Versión Pro (data/pro.json): desactivada por defecto. Con ella desactivada, /pro.html no se indexa.
const proCfg = existsSync(join(ROOT, "data/pro.json")) ? JSON.parse(readFileSync(join(ROOT, "data/pro.json"), "utf8")) : {};
const proOn = proCfg.enabled === true && /^https:\/\//.test(proCfg.checkoutUrl || "");

function proBuy() {
  if (!proOn) return `<p class="muted">Todavía no está a la venta. Las herramientas siguen siendo gratis y sin marca de agua.</p>`;
  return `<a class="btn btn-primary" href="${esc(proCfg.checkoutUrl)}" rel="noopener">Comprar Pro</a>
<p class="muted small">El pago lo gestiona ${esc(proCfg.provider === "stripe" ? "Stripe" : proCfg.provider === "paddle" ? "Paddle" : "la pasarela de pago")}, que emite la factura con el IVA de tu país. Recibirás tu clave de licencia por correo.</p>`;
}

const UI = {
  es: {
    home: "Inicio", transcribe: "Audio a texto", captions: "Subtítulos", luz: "Tarifa de luz", faq: "Preguntas frecuentes", privacy: "Privacidad", legal: "Aviso legal",
    contact: "Contacto", money: "Cómo ganamos dinero", skip: "Saltar al contenido", tagline: "Transcripción de audio y vídeo gratis y privada",
    footerNote: "Herramientas gratuitas financiadas con publicidad. Tus archivos se procesan en tu dispositivo.",
    related: "Más herramientas gratis",
    otherLang: "English", otherLangLabel: "Read in English",
  },
  en: {
    home: "Home", transcribe: "Audio to text", captions: "Captions", faq: "FAQ", privacy: "Privacy", legal: "Legal notice",
    contact: "Contact", money: "How we make money", skip: "Skip to content", tagline: "Free and private audio and video transcription",
    footerNote: "Free tools supported by ads. Your files are processed on your device.",
    related: "More free tools",
    otherLang: "Español", otherLangLabel: "Leer en español",
  },
};

const LINKS = {
  es: { home: "", transcribe: "pasar-audio-a-texto/", captions: "subtitulos-animados/", luz: "luz/", luzhoy: "luz/precio-luz-hoy.html", itp: "calculadora-itp-coche/", faq: "preguntas-frecuentes.html", privacy: "privacidad.html", legal: "aviso-legal.html", contact: "contacto.html", money: "como-ganamos-dinero.html" },
  en: { home: "en/", transcribe: "en/audio-to-text/", captions: "en/animated-captions/", faq: "en/faq.html", privacy: "en/privacy.html", legal: "en/legal.html", contact: "en/contact.html", money: "en/how-we-make-money.html" },
};

// Tarjetas de herramientas (portada y enlaces cruzados al final de cada herramienta).
const CARDS = [
  {
    tool: "transcribe", icon: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-2.07A7 7 0 0 1 5 12Z",
    es: { title: "Pasar audio a texto", text: "Transcribe notas de voz, clases, entrevistas y vídeos. Descarga TXT, SRT o VTT." },
    en: { title: "Audio to text", text: "Transcribe voice notes, lectures, interviews and videos. Download TXT, SRT or VTT." },
  },
  {
    tool: "captions", icon: "M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4Zm2 9h5v2H6v-2Zm7 0h5v2h-5v-2ZM6 10h9v2H6v-2Z",
    es: { title: "Subtítulos animados", text: "Subtítulos tipo karaoke grabados en tu vídeo para Reels, TikTok y Shorts. Sin marca de agua." },
    en: { title: "Animated captions", text: "Karaoke-style captions burned into your video for short-form platforms. No watermark." },
  },
  {
    tool: "luz", icon: "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
    es: { title: "¿Qué tarifa de luz me conviene?", text: "Compara la tarifa regulada y las más contratadas con tu consumo real, en un clic." },
  },
  {
    tool: "luzhoy", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v4.6l3.2 3.2-1.4 1.4L11 12.4V7h2Z",
    es: { title: "Precio de la luz hoy", text: "La hora más barata de hoy y de mañana, con los datos oficiales de cada hora." },
  },
  {
    tool: "itp", icon: "M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2Zm2.1 0h9.8l-1.2-3.6a.6.6 0 0 0-.5-.4H8.8a.6.6 0 0 0-.5.4L7.1 11ZM7 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    es: { title: "Calculadora ITP coche", text: "Cuánto pagas de impuesto al comprar un coche o una moto de segunda mano en tu comunidad." },
  },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function readPages() {
  const pages = [];
  for (const lang of ["es", "en"]) {
    const dir = join(ROOT, "src/pages", lang);
    for (const f of readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".html")).sort()) {
      const raw = readFileSync(join(dir, f), "utf8");
      const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
      if (!m) throw new Error(`Falta la cabecera JSON en ${lang}/${f}`);
      const meta = JSON.parse(m[1]);
      pages.push({ lang, file: f, ...meta, body: raw.slice(m[0].length) });
    }
  }
  return pages;
}

// Herramientas del sitio: plantilla HTML, textos y script de cada una.
// En la cabecera JSON de una página, "tool": true equivale a "transcribe".
const TOOLS = {
  transcribe: { partial: "tool.html", strings: STRINGS, script: "assets/js/app.js", category: "MultimediaApplication" },
  captions: { partial: "captions.html", strings: CAPTIONS_STRINGS, script: "assets/js/captions/app.js", category: "MultimediaApplication" },
  gasto: { partial: "gasto.html", strings: LUZ_STRINGS, script: "assets/js/luz/gasto.js", category: "UtilitiesApplication" },
  luzhoy: { partial: "luz-hoy.html", strings: LUZ_STRINGS, script: "assets/js/luz/hoy.js", category: "UtilitiesApplication" },
  luz: { partial: "luz.html", strings: LUZ_STRINGS, script: "assets/js/luz/app.js", category: "FinanceApplication" },
  coste: { partial: "coste.html", strings: LUZ_STRINGS, script: "assets/js/luz/coste.js", category: "UtilitiesApplication" },
  coche: { partial: "coche.html", strings: LUZ_STRINGS, script: "assets/js/luz/coste.js", category: "UtilitiesApplication" },
  itp: { partial: "itp.html", strings: { es: {}, en: {} }, script: "assets/js/itp/app.js", category: "FinanceApplication" },
};
const toolOf = (page) => (page.tool === true ? "transcribe" : page.tool || null);

function languageOptions(lang, autoLabel) {
  const langIdx = lang === "es" ? 1 : 2;
  const langs = [...AUDIO_LANGUAGES].sort((a, b) => (a[0] === lang ? -1 : b[0] === lang ? 1 : 0));
  return [`<option value="auto">${esc(autoLabel)}</option>`]
    .concat(langs.map(([code, ...names]) => `<option value="${code}"${code === lang ? " selected" : ""}>${esc(names[langIdx - 1])}</option>`))
    .join("\n        ");
}

// Resumen estático de los precios del PVPC de hoy (el día en que se genera la web), para buscadores y para
// quien no tenga JavaScript. En el navegador se sustituye por los datos más recientes y los gráficos.
function pvpcSnapshot(mode) {
  const f = join(ROOT, "data", "pvpc.json");
  if (!existsSync(f)) return "";
  const pvpc = JSON.parse(readFileSync(f, "utf8"));
  const hh = (h) => `${String(h).padStart(2, "0")}:00`;
  const eur = (p) => p.toFixed(3).replace(".", ",") + " €/kWh";
  const order = mode === "manana" ? [["Mañana", 1], ["Hoy", 0]] : [["Hoy", 0], ["Mañana", 1]];
  return order.map(([label, off]) => {
    const st = dayStats(pvpc, madridDate(off));
    if (!st) return "";
    const date = new Date(st.date + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    return `<section class="day card"><h2>${label}: ${date}</h2><p>La hora más barata es de ${hh(st.min.h)} a ${hh(st.min.h + 1)} (${eur(st.min.p)}) y la más cara de ${hh(st.max.h)} a ${hh(st.max.h + 1)} (${eur(st.max.p)}). Precio medio: ${eur(st.mean)}.${st.best3 ? ` La mejor franja de 3 horas seguidas empieza a las ${hh(st.best3.start)}.` : ""}</p></section>`;
  }).join("\n");
}

// Frase con las medias del PVPC del último año (se genera en el build con data/pvpc.json).
function pvpcAverages() {
  const f = join(ROOT, "data", "pvpc.json");
  if (!existsSync(f)) return "Los precios medios del último año aparecerán aquí en cuanto se publiquen los datos de Red Eléctrica.";
  const { avg365: a, from, to } = JSON.parse(readFileSync(f, "utf8"));
  const e = (p) => p.toFixed(3).replace(".", ",");
  const d = (iso) => iso.split("-").reverse().join("/");
  return `Según los datos de Red Eléctrica (del ${d(from)} al ${d(to)}), el precio medio de la energía del PVPC en los últimos 12 meses fue de ${e(a.P1)} €/kWh en punta, ${e(a.P2)} €/kWh en llano y ${e(a.P3)} €/kWh en valle, sin impuestos. La diferencia entre punta y valle es lo que hace que convenga mover consumo a las horas baratas.`;
}

// «Estudio: las horas más baratas de la luz»: cifras, gráficos SVG y tablas generados con data/pvpc.json.
const STUDY_YEAR = 2026;
const RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
function readPvpc() { try { return JSON.parse(readFileSync(PVPC_FILE, "utf8")); } catch { return null; } }
function studyHtml() {
  const pv = readPvpc();
  const st = pv && computeStudy(pv, STUDY_YEAR, madridDate(0));
  if (!st) return `<p class="status">Los datos del estudio se generan con los precios oficiales de Red Eléctrica en cada publicación de la web. Ahora mismo no están disponibles: vuelve a intentarlo más tarde.</p>`;
  const e3 = (p) => p.toFixed(3).replace(".", ",");
  const pct = (x) => `${Math.round(x * 100)} %`;
  const hh = (h) => `${String(h).padStart(2, "0")}:00`;
  const span = (h) => `${hh(h)}–${hh(h + 1)}`;
  const d = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  // Gráfico de barras: precio medio de cada hora del día.
  const W = 640, H = 240, L = 46, B = 26, TOP = 16, max = Math.max(...st.byHour) * 1.1, slot = (W - L - 6) / 24, bw = slot * 0.72;
  const y = (v) => TOP + (H - TOP - B) * (1 - v / max);
  let bars = "";
  for (let k = 0; k <= 3; k++) { const v = (max * k) / 3; bars += `<line x1="${L}" x2="${W - 6}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="${k ? "grid" : "axis"}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" class="tick" text-anchor="end">${v.toFixed(2).replace(".", ",")}</text>`; }
  st.byHour.forEach((p, h) => {
    const x = L + slot * h + (slot - bw) / 2, top = y(p), r = Math.min(4, (H - B - top) / 2);
    const cheap = st.cheapest3.includes(h);
    bars += `<g class="bar"><title>${span(h)}: ${e3(p)} €/kWh de media${cheap ? " (de las 3 más baratas)" : ""}</title><path class="${cheap ? "seg-P3" : "seg-P1"}" d="M${x.toFixed(1)},${H - B} V${(top + r).toFixed(1)} Q${x.toFixed(1)},${top.toFixed(1)} ${(x + r).toFixed(1)},${top.toFixed(1)} H${(x + bw - r).toFixed(1)} Q${(x + bw).toFixed(1)},${top.toFixed(1)} ${(x + bw).toFixed(1)},${(top + r).toFixed(1)} V${H - B} Z"/></g>`;
    if (h % 3 === 0) bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" class="tick" text-anchor="middle">${h}</text>`;
  });
  const chart = `<figure class="study-fig"><svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Precio medio del PVPC por hora del día en ${STUDY_YEAR}"><text x="${L - 6}" y="10" class="tick" text-anchor="end">€/kWh</text>${bars}</svg>
<figcaption><span class="legend"><span><i class="sw sw-P3"></i>Las 3 horas más baratas de media</span><span><i class="sw sw-P1"></i>Resto de horas</span></span> Precio medio de la energía del PVPC por hora del día (sin impuestos), del ${d(st.from)} al ${d(st.to)}. Fuente: Red Eléctrica.</figcaption></figure>`;
  // Mapa de calor: mes × hora.
  const hmax = Math.max(...st.months.flatMap((m) => m.hours)), hmin = Math.min(...st.months.flatMap((m) => m.hours));
  const cell = (v) => RAMP[Math.min(RAMP.length - 1, Math.floor(((v - hmin) / (hmax - hmin || 1)) * (RAMP.length - 1)))];
  const heat = `<figure class="study-fig"><div class="heat-wrap"><div class="heat heat-months" role="img" aria-label="Precio medio por mes y hora del día"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="heat-h">${h % 3 === 0 ? h : ""}</span>`).join("")}
${st.months.map((m) => `<span class="heat-d">${m.name.slice(0, 3)}</span>${m.hours.map((v, h) => `<span class="cell" style="background:${cell(v)}" title="${m.name} ${span(h)}: ${e3(v)} €/kWh"></span>`).join("")}`).join("\n")}</div></div>
<div class="heat-legend"><span>${e3(hmin)}</span><i style="background:linear-gradient(90deg,${RAMP.join(",")})"></i><span>${e3(hmax)} €/kWh</span></div>
<figcaption>Precio medio de cada hora del día, mes a mes (más oscuro = más caro).</figcaption></figure>`;
  const monthRows = st.months.map((m) => `<tr><td>${m.name[0].toUpperCase() + m.name.slice(1)}</td><td class="num">${e3(m.mean)}</td><td>${span(m.cheapest.h)} (${e3(m.cheapest.p)})</td><td>${span(m.dearest.h)} (${e3(m.dearest.p)})</td></tr>`).join("");
  const hourRows = st.byHour.map((p, h) => `<tr><td>${span(h)}</td><td class="num">${e3(p)}</td><td class="num">${st.counts[h]}</td></tr>`).join("");
  const saving = st.spread * 365 * (1 + RULES.electricityTax) * (1 + RULES.vat);
  return `<div class="kpis study-kpis">
  <div class="kpi"><span class="kpi-label">Hora más barata de media</span><strong class="kpi-value">${span(st.cheapest.h)}</strong><span class="kpi-sub">${e3(st.cheapest.p)} €/kWh</span></div>
  <div class="kpi"><span class="kpi-label">Hora más cara de media</span><strong class="kpi-value">${span(st.dearest.h)}</strong><span class="kpi-sub">${e3(st.dearest.p)} €/kWh</span></div>
  <div class="kpi"><span class="kpi-label">Diferencia</span><strong class="kpi-value">${Math.round((st.dearest.p / st.cheapest.p - 1) * 100)} %</strong><span class="kpi-sub">más cara la peor hora que la mejor</span></div>
  <div class="kpi"><span class="kpi-label">Días analizados</span><strong class="kpi-value">${st.nDays}</strong><span class="kpi-sub">del ${d(st.from)} al ${d(st.to)}</span></div>
</div>
<h2>Las conclusiones</h2>
<ul class="study-findings">
  <li>De media, las tres horas más baratas de ${STUDY_YEAR} han sido <strong>${st.cheapest3.map(span).join(", ")}</strong>, y las tres más caras, <strong>${st.dearest3.map(span).join(", ")}</strong>.</li>
  <li>La hora más barata de cada día cayó <strong>de madrugada (00:00–08:00) el ${pct(st.shareNight)} de los días</strong> y <strong>en horas de sol (10:00–18:00) el ${pct(st.shareSolar)}</strong>.</li>
  <li>El precio medio fue de <strong>${e3(st.weekday)} €/kWh en laborables</strong> y de <strong>${e3(st.weekend)} €/kWh en fines de semana y festivos</strong> (media del año: ${e3(st.mean)} €/kWh, sin impuestos).</li>
  <li>El día más barato fue el <strong>${d(st.cheapestDay.date)}</strong> (${e3(st.cheapestDay.mean)} €/kWh de media) y el más caro, el <strong>${d(st.dearestDay.date)}</strong> (${e3(st.dearestDay.mean)} €/kWh).</li>
  <li>Mover <strong>1 kWh al día</strong> de la hora más cara a la más barata (de media) supone unos <strong>${saving.toFixed(0)} € al año</strong> con impuestos, en la tarifa regulada.</li>
</ul>
<h2>Precio medio por hora del día</h2>
${chart}
<details class="data-table"><summary>Ver la tabla: precio medio por hora y cuántos días fue la más barata</summary><div class="table-wrap"><table><thead><tr><th>Hora</th><th>€/kWh medio</th><th>Días que fue la más barata</th></tr></thead><tbody>${hourRows}</tbody></table></div></details>
<h2>Mes a mes</h2>
${heat}
<div class="table-wrap"><table><thead><tr><th>Mes</th><th>€/kWh medio</th><th>Hora más barata (media)</th><th>Hora más cara (media)</th></tr></thead><tbody>${monthRows}</tbody></table></div>
<p><a class="btn" href="{{root}}data/pvpc-${STUDY_YEAR}.csv" download>Descargar los datos (CSV, ${st.nDays * 24} filas)</a></p>`;
}

// Texto del crédito «Hecho con …» de los vídeos. Con dominio propio se añade (se lee bien en un vídeo);
// una dirección larga de github.io, no.
function creditText(lang) {
  const host = new URL(siteUrl).host.replace(/^www\./, "");
  return `${lang === "es" ? "Hecho con" : "Made with"} ${site.siteName}${/github\.io$/.test(host) ? "" : ` · ${host}`}`;
}

function toolHtml(tool, lang, page) {
  const t = TOOLS[tool].strings[lang];
  return readFileSync(join(ROOT, "src/partials", TOOLS[tool].partial), "utf8")
    .replace("{{languageOptions}}", () => languageOptions(lang, t.autoDetect))
    .replace("{{pvpcSnapshot}}", () => pvpcSnapshot(page.mode))
    .replace(/\{\{credit\}\}/g, () => esc(creditText(lang)))
    .replace(/\{\{mode\}\}/g, esc(page.mode || ""))
    .replace(/\{\{c\.(\w+)\}\}/g, (_, k) => esc(page.coste?.[k] ?? ""))
    .replace(/\{\{platform\}\}/g, esc(page.platform || ""))
    .replace(/\{\{preset\}\}/g, esc(page.preset || ""))
    .replace(/\{\{t\.(\w+)\}\}/g, (_, k) => {
      if (!(k in t)) throw new Error(`Texto sin traducir (${tool}/${lang}): ${k}`);
      return esc(t[k]);
    });
}

function faqSchema(body) {
  const items = [...body.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (!items.length) return null;
  const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([, q, a]) => ({
      "@type": "Question",
      name: strip(q),
      acceptedAnswer: { "@type": "Answer", text: strip(a) },
    })),
  };
}

function appSchema(page, url) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: page.appName || site.siteName,
    url,
    description: page.description,
    applicationCategory: TOOLS[toolOf(page)].category,
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and WebAssembly",
    inLanguage: page.lang,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };
}

// Secciones del sitio: cada página de guía se agrupa con su herramienta para las migas de pan y el enlazado interno.
const SECTIONS = {
  es: { luz: { href: "luz/", label: "Luz" }, captions: { href: "subtitulos-animados/", label: "Subtítulos" }, transcribe: { href: "pasar-audio-a-texto/", label: "Audio a texto" } },
  en: { captions: { href: "en/animated-captions/", label: "Captions" }, transcribe: { href: "en/audio-to-text/", label: "Audio to text" } },
};
function sectionOf(page) {
  if (page.section !== undefined) return page.section;
  const dir = page.slug.includes("/") ? page.slug.replace(/^en\//, "").split("/")[0] : "";
  if (dir === "luz") return "luz";
  if (dir === "subtitulos-animados" || dir === "animated-captions") return "captions";
  if (dir === "pasar-audio-a-texto" || dir === "audio-to-text") return "transcribe";
  if (toolOf(page) === "transcribe") return "transcribe";
  return null;
}
const stripTags = (h) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
// Nombre corto de una página para enlaces: "nav" en la cabecera JSON o, si no, su <h1>.
const navLabel = (p) => p.nav || stripTags(p.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || p.title.split(" | ")[0]);
const isIndexable = (p) => !p.noindex && !p.bare && !(p.proPage && !proOn);

// Fecha real de la última modificación (último commit que tocó el archivo). Sin git, la de site.config.json.
function gitDate(file) {
  try { return execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; } catch { return null; }
}
const PVPC_FILE = join(ROOT, "data", "pvpc.json");
const pvpcUpdated = () => { try { return JSON.parse(readFileSync(PVPC_FILE, "utf8")).updated?.slice(0, 10) || null; } catch { return null; } };
function lastmod(page) {
  const dates = [gitDate(join("src/pages", page.lang, page.file)) || site.lastUpdated];
  // Las páginas que muestran precios del día cambian cada día aunque no se toque su archivo.
  if (page.daily && pvpcUpdated()) dates.push(pvpcUpdated());
  return dates.sort().at(-1);
}

// Imagen para redes sociales: assets/img/og/<slug>.jpg si existe (scripts/og-images.mjs), si no la general.
const ogName = (slug) => slug.replace(/\.html$/, "").replace(/(^|\/)index$/, "$1").replace(/\/$/, "").replace(/\//g, "--") || "index";
function ogImage(page) {
  const name = ogName(page.slug);
  return existsSync(join(ROOT, "assets/img/og", name + ".jpg")) ? `assets/img/og/${name}.jpg` : "assets/img/og.jpg";
}

// Estadística GoatCounter (sin cookies). Desactivada mientras site.config.json → goatcounter esté vacío.
function analyticsTag() {
  const tags = [];
  const code = String(process.env.GOATCOUNTER ?? site.goatcounter ?? "").trim();
  if (/^[a-z0-9-]+$/i.test(code)) tags.push(`<script data-goatcounter="https://${code}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`);
  // Cloudflare Web Analytics (sin cookies). Solo con un token válido: 32 caracteres hexadecimales.
  const cf = String(process.env.CLOUDFLARE_ANALYTICS ?? site.cloudflareAnalytics ?? "").trim();
  if (/^[0-9a-f]{32}$/i.test(cf)) tags.push(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${cf}"}'></script>`);
  return tags.join("\n");
}

// Datos del PVPC como conjunto de datos (Google Dataset Search). Solo se declara si data/pvpc.json existe.
function datasetSchema(page, url) {
  let pv = null;
  try { pv = JSON.parse(readFileSync(PVPC_FILE, "utf8")); } catch {}
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Precio horario de la luz PVPC 2.0TD (península)",
    description: "Precio de la energía de la tarifa regulada PVPC 2.0TD en España peninsular, hora a hora, en €/kWh sin impuestos. Se actualiza cada día con los datos publicados por Red Eléctrica (REE).",
    url,
    inLanguage: "es",
    isAccessibleForFree: true,
    keywords: ["precio de la luz", "PVPC", "tarifa regulada", "precio por horas", "España"],
    creator: { "@type": "Organization", name: site.siteName, url: `${siteUrl}/` },
    isBasedOn: "https://www.ree.es/es/datos/mercados",
    spatialCoverage: { "@type": "Place", name: "España peninsular" },
    ...(pv?.from && pv?.to ? { temporalCoverage: `${pv.from}/${pv.to}`, dateModified: pv.updated } : {}),
    distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${siteUrl}/data/pvpc.json` }],
  };
}

// Hueco de anuncio. Si AdSense está activado y el hueco tiene ID, se reserva su alto desde el HTML (clase ad-on):
// así no hay salto de contenido (CLS) cuando llega el anuncio. Sin anuncios, el hueco no ocupa nada.
function adSlot(slot) {
  const on = adsCfg.adsEnabled === true && /^ca-pub-\d+$/.test((adsCfg.adsenseClient || "").trim()) && !!(adsCfg.slots || {})[slot];
  return `<div class="ad-slot${on ? " ad-on" : ""}" data-slot="${slot}"></div>`;
}

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true" class="logo"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M8 13v6M12 10v12M16 7v18M20 11v10M24 14v4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;

// Página «desnuda» para insertar en otras webs con un iframe (widget): sin cabecera, menú, pie ni anuncios.
function bareLayout(page, url, root) {
  const body = page.body.replace(/\{\{root\}\}/g, root).replace(/\{\{siteUrl\}\}/g, siteUrl);
  return `<!doctype html>
<html lang="${page.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="noindex">
${page.style ? `<link rel="stylesheet" href="${root}${page.style}">` : ""}
</head>
<body>
${body.trim()}
${analyticsTag()}
${page.script ? `<script type="module" src="${root}${page.script}"></script>` : ""}
</body>
</html>
`;
}

function layout(page, pagesBySlug) {
  const lang = page.lang;
  const ui = UI[lang];
  const depth = page.slug.split("/").length - 1;
  // La página 404 se sirve desde cualquier ruta, así que usa enlaces absolutos.
  const root = page.absolute ? `${siteUrl}/` : depth ? "../".repeat(depth) : "./";
  const href = (slug) => (slug === "" ? root : root + slug);
  const url = `${siteUrl}/${page.slug.replace(/index\.html$/, "")}`;
  const alt = page.alt != null ? pagesBySlug.get(page.alt) : null;
  const altUrl = alt ? `${siteUrl}/${alt.slug.replace(/index\.html$/, "")}` : null;
  const L = LINKS[lang];
  if (page.bare) return bareLayout(page, url, root);

  const schemas = [];
  const tool = toolOf(page);
  if (tool) schemas.push(appSchema(page, url));
  if (page.faqSchema) { const s = faqSchema(page.body); if (s) schemas.push(s); }
  if (page.slug.endsWith("index.html") || page.slug === "index.html") {
    schemas.push({ "@context": "https://schema.org", "@type": "WebSite", name: site.siteName, url: `${siteUrl}/`, inLanguage: lang });
  }
  if (page.slug === "index.html" || page.slug === "en/index.html") {
    schemas.push({ "@context": "https://schema.org", "@type": "Organization", name: site.siteName, url: `${siteUrl}/`, logo: `${siteUrl}/assets/img/icon-512.png`, ...(site.telegram ? { sameAs: [site.telegram] } : {}) });
  }
  if (page.dataset) schemas.push(datasetSchema(page, url));

  // Migas de pan (visibles y en datos estructurados) para las páginas que cuelgan de una herramienta.
  const section = sectionOf(page);
  const secInfo = section && SECTIONS[lang]?.[section];
  const crumbs = [];
  if (secInfo && page.slug !== secInfo.href + "index.html" && !page.absolute) {
    crumbs.push([ui.home, href(L.home), `${siteUrl}/`], [secInfo.label, href(secInfo.href), `${siteUrl}/${secInfo.href}`], [navLabel(page), null, url]);
    schemas.push({
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: crumbs.map(([name, , item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
    });
  }
  // Enlazado interno: el resto de guías de la misma sección.
  const guides = section ? [...pagesBySlug.values()].filter((p) => p !== page && p.lang === lang && isIndexable(p) && sectionOf(p) === section) : [];

  const here = page.slug.replace(/index\.html$/, "");
  const nav = (key, label, section = false) => {
    const current = L[key] === here || L[key] === page.slug;
    return `<a href="${href(L[key])}"${current ? ' aria-current="page"' : section ? ' aria-current="true"' : ""}>${label}</a>`;
  };
  const exists = (k) => L[k] && (pagesBySlug.has(L[k]) || pagesBySlug.has(L[k] + "index.html"));
  const cards = (except) => CARDS.filter((c) => c[lang] && c.tool !== except && exists(c.tool))
    .map((c) => `<a class="tool-card" href="${href(L[c.tool])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${c.icon}"/></svg><strong>${esc(c[lang].title)}</strong><span>${esc(c[lang].text)}</span></a>`).join("\n");

  let body = page.body
    .replace("{{tool}}", () => (tool ? toolHtml(tool, lang, page) : ""))
    .replace(/\{\{ad:(\w+)\}\}/g, (_, s) => adSlot(s))
    .replace(/<div class="ad-slot" data-slot="(\w+)"><\/div>/g, (_, s) => adSlot(s))
    .replace(/\{\{cfg\.(\w+)\}\}/g, (_, k) => esc(site[k] ?? ""))
    .replace("{{toolCards}}", () => `<div class="tool-cards">${cards(null)}</div>`)
    .replace("{{pvpcAverages}}", () => pvpcAverages())
    .replace("{{study}}", () => studyHtml())
    .replace("{{proPrice}}", () => esc(proOn && proCfg.price ? proCfg.price : "Pago único"))
    .replace("{{proBuy}}", () => proBuy())
    .replace(/\{\{siteUrl\}\}/g, siteUrl)
    .replace(/\{\{moneyHref\}\}/g, () => href(L.money))
    .replace(/\{\{proHref\}\}/g, () => href("pro.html"))
    .replace(/\{\{root\}\}/g, root);

  const hreflang = alt
    ? `<link rel="alternate" hreflang="${lang}" href="${url}">
<link rel="alternate" hreflang="${alt.lang}" href="${altUrl}">
<link rel="alternate" hreflang="x-default" href="${lang === "es" ? url : altUrl}">`
    : "";

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
${hreflang}
<meta name="robots" content="${page.noindex || (page.proPage && !proOn) ? "noindex" : "index, follow"}">
<meta name="theme-color" content="#4f46e5">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.siteName)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${siteUrl}/${ogImage(page)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(navLabel(page))}">
<meta property="og:locale" content="${lang === "es" ? "es_ES" : "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}favicon.ico" sizes="48x48">
<link rel="icon" href="${root}assets/img/icon-96.png" sizes="96x96" type="image/png">
<link rel="icon" href="${root}assets/img/icon-192.png" sizes="192x192" type="image/png">
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="${root}site.webmanifest">
<link rel="apple-touch-icon" href="${root}assets/img/icon-180.png">
<link rel="stylesheet" href="${root}assets/css/style.css">
${/^ca-pub-\d+$/.test((adsCfg.adsenseClient || "").trim()) ? `<meta name="google-adsense-account" content="${esc(adsCfg.adsenseClient.trim())}">\n` : ""}${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n")}
</head>
<body>
<a class="skip" href="#main">${ui.skip}</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${href(L.home)}">${LOGO}<span>${esc(site.siteName)}</span></a>
    <nav aria-label="${lang === "es" ? "Principal" : "Main"}">
      ${["transcribe", "captions", "luz"].filter((k) => L[k] && pagesBySlug.has(L[k] + "index.html")).map((k) => nav(k, ui[k], tool === k)).join("\n      ")}
    </nav>
    ${alt ? `<a href="${href(alt.slug.replace(/index\.html$/, ""))}" hreflang="${alt.lang}" lang="${alt.lang}" title="${ui.otherLangLabel}" class="lang">${ui.otherLang}</a>` : ""}
  </div>
</header>
<div class="wrap">${adSlot("top")}</div>
<main id="main" class="wrap">
${crumbs.length ? `<nav class="crumbs" aria-label="${lang === "es" ? "Estás en" : "You are here"}"><ol>${crumbs.map(([name, h]) => `<li>${h ? `<a href="${h}">${esc(name)}</a>` : `<span aria-current="page">${esc(name)}</span>`}</li>`).join("")}</ol></nav>` : ""}
${body.trim()}
${section === "luz" && site.telegram ? `<aside class="tg-cta" aria-label="Canal de Telegram"><p><strong>Recibe cada tarde el precio de mañana.</strong> Las horas más baratas y más caras del día siguiente, en un mensaje a las 20:40. Gratis y sin registrarte en ninguna web.</p><a class="btn btn-primary" href="${esc(site.telegram)}" rel="noopener">Unirme al canal de Telegram</a></aside>` : ""}
${guides.length ? `<nav class="guides" aria-labelledby="guides-title"><h2 id="guides-title">${lang === "es" ? "Guías relacionadas" : "Related guides"}</h2><ul>${guides.map((p) => `<li><a href="${href(p.slug.replace(/index\.html$/, ""))}">${esc(navLabel(p))}</a></li>`).join("")}</ul></nav>` : ""}
${tool && cards(tool) ? `<aside class="related" aria-labelledby="related-title"><h2 id="related-title">${ui.related}</h2><div class="tool-cards">${cards(tool)}</div></aside>` : ""}
</main>
<div class="wrap">${adSlot("bottom")}</div>
<footer class="site-footer">
  <div class="wrap">
    <nav aria-label="${lang === "es" ? "Legal" : "Legal"}">
      ${nav("faq", ui.faq)}
      ${nav("privacy", ui.privacy)}
      ${nav("legal", ui.legal)}
      ${nav("contact", ui.contact)}
      ${exists("money") ? nav("money", ui.money) : ""}
    </nav>
    <p class="muted small">© ${new Date().getFullYear()} ${esc(site.siteName)} · ${ui.footerNote}</p>
  </div>
</footer>
${analyticsTag()}
<script src="${root}assets/js/config.js"></script>
<script src="${root}assets/js/ads.js" defer></script>
${tool ? `<script type="module" src="${root}${TOOLS[tool].script}"></script>` : ""}
${page.script ? `<script type="module" src="${root}${page.script}"></script>` : ""}
</body>
</html>
`;
}

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
  // Favicon en la raíz (Google y los navegadores lo buscan ahí) y manifiesto con los iconos.
  cpSync(join(ROOT, "assets/img/favicon.ico"), join(OUT, "favicon.ico"));
  writeFileSync(join(OUT, "site.webmanifest"), JSON.stringify({ name: site.siteName, short_name: site.siteName, start_url: basePath, display: "browser", theme_color: "#4f46e5", background_color: "#ffffff", icons: [48, 96, 192, 512].map((s) => ({ src: `${basePath}assets/img/icon-${s}.png`, sizes: `${s}x${s}`, type: "image/png" })) }, null, 2));
  // Datos de las herramientas (tarifas de luz a mano; data/pvpc.json lo genera scripts/fetch-pvpc.mjs en Actions).
  if (existsSync(join(ROOT, "data"))) cpSync(join(ROOT, "data"), join(OUT, "data"), { recursive: true, filter: (src) => !/\/\./.test(src.slice(ROOT.length)) });
  writeFileSync(join(OUT, ".nojekyll"), "");
  // Versión ligera del PVPC para el widget (de ayer a pasado mañana): ~1 KB en vez de todo el año.
  if (existsSync(join(ROOT, "data", "pvpc.json"))) {
    const pv = JSON.parse(readFileSync(join(ROOT, "data", "pvpc.json"), "utf8"));
    const keep = [-1, 0, 1, 2].map((d) => madridDate(d));
    const days = Object.fromEntries(keep.filter((d) => pv.days?.[d]).map((d) => [d, pv.days[d]]));
    writeFileSync(join(OUT, "data", "pvpc-hoy.json"), JSON.stringify({ updated: pv.updated, source: pv.source, days }));
  }

  // Datos del estudio en CSV (para periodistas y quien quiera comprobar los cálculos).
  { const pv = readPvpc(); if (pv) writeFileSync(join(OUT, "data", `pvpc-${STUDY_YEAR}.csv`), studyCSV(pv, STUDY_YEAR, madridDate(0))); }
  const pages = readPages();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  for (const p of pages) {
    const dest = join(OUT, p.slug);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, layout(p, bySlug));
  }

  const indexable = pages.filter(isIndexable);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${indexable.map((p) => {
    const loc = `${siteUrl}/${p.slug.replace(/index\.html$/, "")}`;
    const alt = p.alt != null ? bySlug.get(p.alt) : null;
    const links = alt
      ? `\n    <xhtml:link rel="alternate" hreflang="${p.lang}" href="${loc}"/>\n    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${siteUrl}/${alt.slug.replace(/index\.html$/, "")}"/>`
      : "";
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod(p)}</lastmod>${links}\n  </url>`;
  }).join("\n")}
</urlset>
`;
  writeFileSync(join(OUT, "sitemap.xml"), sitemap);
  writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

  const client = (adsCfg.adsenseClient || "").trim();
  // IndexNow (Bing, Yandex, Seznam…): archivo con la clave en la raíz. El aviso lo envía scripts/indexnow.mjs.
  if (/^[a-f0-9]{32}$/.test(site.indexNowKey || "")) writeFileSync(join(OUT, `${site.indexNowKey}.txt`), site.indexNowKey);
  // ads.txt siempre en la raíz. Sin ID de AdSense solo lleva un comentario (archivo válido, sin vendedores autorizados).
  writeFileSync(join(OUT, "ads.txt"), /^ca-pub-\d+$/.test(client)
    ? `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`
    : `# ${site.siteName}: añade tu ID de AdSense en assets/js/config.js y se generará la línea de Google.\n`);
  console.log(`Generadas ${pages.length} páginas en _site/ (URL base: ${siteUrl})${existsSync(join(OUT, "ads.txt")) ? " + ads.txt" : ""}`);
}

build();
