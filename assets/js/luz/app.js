import { STRINGS } from "./i18n.js";
import { RULES, PERIODS, periodOf, parseConsumptionCSV, summarize, rankOffers, billFor, billFromEnergy, shift, powerSavingPerYear, baseLoadCostPerYear, sampleRows, quickSummary, CsvError } from "./core.js";
import { pvpcEnergy } from "./pvpc.js";
import { SOLAR_DEFAULTS, solarEstimate, suggestSize } from "./solar.js";

const T = STRINGS.es;
const $ = (id) => document.getElementById(id);
const fmt = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));
const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });
const num = (n, d = 0) => n.toLocaleString("es-ES", { maximumFractionDigits: d, minimumFractionDigits: d });
const dateES = (iso) => iso.slice(0, 10).split("-").reverse().join("/");
const MONTHS = T.monthsShort.split(",");
const WD = T.weekdays.split(",");
const WDL = T.weekdaysLong.split(",");
const SVGNS = "http://www.w3.org/2000/svg";
const DATA = (f) => new URL(`../../../data/${f}`, import.meta.url);

const els = {
  drop: $("drop"), fileInput: $("file-input"), example: $("example-btn"), status: $("status"), statusText: $("status-text"),
  quickForm: $("quick-form"), qKwh: $("q-kwh"), qPower: $("q-power"), qValle: $("q-valle"), qValleOut: $("q-valle-out"),
  headline: $("headline"), results: $("results"), kpis: $("kpis"), ranking: $("ranking"), verified: $("verified-note"),
  offers: $("offers"), pw1: $("pw1"), pw2: $("pw2"), addOffer: $("add-offer"), insights: $("insights"),
  sponsored: $("sponsored"), sponsoredList: $("sponsored-list"),
  solar: $("solar"), solarSize: $("solar-size"), solarZone: $("solar-zone"), solarSaving: $("solar-saving"), solarResult: $("solar-result"), solarNote: $("solar-note"), solarCost: $("solar-cost"), solarSurplus: $("solar-surplus"), solarTips: $("solar-tips"), solarMonths: $("solar-months"),
  consumption: $("consumption"), charts: $("charts"), monthly: $("monthly"), heat: $("heat"), rulesNote: $("rules-note"), tip: $("tip"),
};

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("tl.luz." + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("tl.luz." + k, JSON.stringify(v)); } catch {} },
};

// Tarifas propias guardadas (las de ejemplo de la versión anterior se descartan).
function loadMine() {
  const o = store.get("offers");
  if (!Array.isArray(o)) return [];
  return o.filter((x) => x && Array.isArray(x.energy) && Array.isArray(x.power) && !/\(ejemplo\)$/.test(x.name || ""));
}

const state = {
  rows: null, summary: null, catalog: null, pvpc: null,
  mine: loadMine(),
  contract: store.get("contract") || { p1: 4.6, p2: 4.6 },
  current: store.get("current") || "unknown",
  shiftPct: 20,
  solarKwp: null, // null = tamaño recomendado
  solarZone: store.get("solarZone") || "centro",
};

// Una tarifa solo cuenta como patrocinada si está activado en data/ofertas.json y tiene enlace https.
const isSponsored = (o) => state.catalog?.sponsoredEnabled === true && o.sponsored === true && /^https:\/\/[^\s"<>]+$/.test(o.affiliateUrl || "");

// Datos publicados con la web: tarifas de mercado libre (a mano) y PVPC (Actions, a diario).
const dataReady = Promise.all([
  fetch(DATA("ofertas.json")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  fetch(DATA("pvpc.json")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
]).then(([catalog, pvpc]) => {
  state.catalog = catalog;
  state.pvpc = pvpc && pvpc.days && pvpc.avg365 ? pvpc : null;
});

function setStatus(lines, kind = "") {
  els.status.hidden = false;
  els.status.dataset.kind = kind;
  els.statusText.textContent = "";
  for (const [i, l] of lines.entries()) {
    if (i) els.statusText.appendChild(document.createElement("br"));
    els.statusText.append(l);
  }
}

// ---------- carga de datos ----------

async function loadFile(file) {
  let parsed;
  try {
    parsed = parseConsumptionCSV(await file.text());
  } catch (e) {
    if (!(e instanceof CsvError)) console.error(e);
    setStatus([T.parseError], "error");
    return;
  }
  const s = summarize(parsed.rows);
  const msgs = [fmt(T.loaded, { n: num(s.hours), from: dateES(s.first), to: dateES(s.last), cups: parsed.cups ? ` (CUPS ${parsed.cups})` : "" })];
  if (parsed.bad) msgs.push(fmt(T.badRows, { n: parsed.bad }));
  if (parsed.unitWh) msgs.push(T.unitWh);
  if (s.nDays < 300) msgs.push(fmt(T.shortPeriod, { n: s.nDays }));
  setStatus(msgs, "ok");
  show(parsed.rows, s);
}

function loadExample() {
  const rows = sampleRows(365, new Date(Date.now() - 366 * 86400000).toISOString().slice(0, 10));
  setStatus([T.loadedExample], "ok");
  show(rows, summarize(rows));
}

function loadQuick(e) {
  e.preventDefault();
  const kwh = Number(els.qKwh.value), kw = Number(els.qPower.value), pct = Number(els.qValle.value);
  if (!(kwh > 0) || !(kw > 0)) return;
  state.contract = { p1: kw, p2: kw };
  store.set("contract", state.contract);
  setStatus([fmt(T.quickLoaded, { kwh: num(kwh), pct })], "ok");
  show(null, quickSummary(kwh, pct / 100));
}

async function show(rows, summary) {
  await dataReady;
  state.rows = rows;
  state.summary = summary;
  els.results.hidden = false;
  els.headline.hidden = false;
  renderOffers();
  renderAll();
  els.headline.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- tarifas ----------

function allOffers() {
  const list = [];
  if (state.pvpc && state.catalog?.pvpcPower) {
    list.push({ id: "pvpc", name: T.pvpcName, kind: "pvpc", power: state.catalog.pvpcPower.power });
  }
  for (const o of state.catalog?.offers || []) {
    list.push({ ...o, name: `${o.company} · ${o.name}`, energy: o.type === "fixed" ? [o.energy[0], o.energy[0], o.energy[0]] : o.energy });
  }
  state.mine.forEach((o, i) => list.push({ ...o, id: "mine-" + i, custom: true }));
  return list;
}

function costOf(offer) {
  const s = state.summary;
  if (offer.kind === "pvpc") {
    const pv = state.pvpc;
    const energy = state.rows ? pvpcEnergy(state.rows, pv).energy : PERIODS.reduce((a, p) => a + s.byPeriod[p] * (pv.avg365[p] ?? 0), 0);
    return billFromEnergy(energy, s.nDays, offer, state.contract);
  }
  return billFor(s.byPeriod, s.nDays, offer, state.contract);
}

function ranking() {
  return allOffers().map((o) => ({ offer: o, ...costOf(o) })).sort((a, b) => a.total - b.total);
}

function field(label, value, attrs, key, i, idx) {
  const l = document.createElement("label");
  l.append(label);
  const input = document.createElement("input");
  Object.assign(input, attrs);
  input.value = value;
  input.dataset.key = key;
  input.dataset.i = i;
  if (idx != null) input.dataset.idx = idx;
  l.appendChild(input);
  return l;
}

function renderOffers() {
  els.pw1.value = state.contract.p1;
  els.pw2.value = state.contract.p2;
  const frag = document.createDocumentFragment();
  const price = { type: "number", min: "0", max: "2", step: "0.0001", inputMode: "decimal" };
  state.mine.forEach((o, i) => {
    const card = document.createElement("fieldset");
    card.className = "offer";
    const legend = document.createElement("legend");
    legend.textContent = o.name;
    card.appendChild(legend);
    card.appendChild(field(T.offerName, o.name, { type: "text", maxLength: 40 }, "name", i));
    const typeL = document.createElement("label");
    typeL.append(T.offerType);
    const sel = document.createElement("select");
    sel.dataset.key = "type";
    sel.dataset.i = i;
    for (const [v, t] of [["fixed", T.typeFixed], ["periods", T.typePeriods]]) sel.add(new Option(t, v, false, o.type === v));
    typeL.appendChild(sel);
    card.appendChild(typeL);
    if (o.type === "fixed") card.appendChild(field(T.energyFixed, o.energy[0], price, "energy", i, 0));
    else [T.energyP1, T.energyP2, T.energyP3].forEach((lbl, k) => card.appendChild(field(lbl, o.energy[k], price, "energy", i, k)));
    card.appendChild(field(T.powerPriceP1, o.power[0], price, "power", i, 0));
    card.appendChild(field(T.powerPriceP2, o.power[1], price, "power", i, 1));
    card.appendChild(field(T.fee, o.fee || 0, { type: "number", min: "0", max: "100", step: "0.01", inputMode: "decimal" }, "fee", i));
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn-link remove";
    rm.dataset.remove = i;
    rm.textContent = T.remove;
    card.appendChild(rm);
    frag.appendChild(card);
  });
  els.offers.replaceChildren(frag);
}

function saveMine() { store.set("offers", state.mine); }

function onOfferInput(e) {
  const t = e.target;
  const i = Number(t.dataset.i);
  const o = state.mine[i];
  if (!o || !t.dataset.key) return;
  const key = t.dataset.key;
  if (key === "name") {
    o.name = t.value.trim() || `${T.myOffer} ${i + 1}`;
    t.closest("fieldset").querySelector("legend").textContent = o.name;
  } else if (key === "type") {
    o.type = t.value;
    if (o.type === "periods" && o.energy.every((x) => x === o.energy[0])) o.energy = [o.energy[0] * 1.45, o.energy[0] * 0.96, o.energy[0] * 0.66].map((x) => Math.round(x * 10000) / 10000);
    if (o.type === "fixed") o.energy = [o.energy[0], o.energy[0], o.energy[0]];
    renderOffers();
  } else {
    const v = Number(String(t.value).replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return;
    if (key === "fee") o.fee = v;
    else if (key === "energy" && o.type === "fixed") o.energy = [v, v, v];
    else o[key][Number(t.dataset.idx)] = v;
  }
  saveMine();
  renderAll();
}

// ---------- resultados ----------

function renderAll() {
  const s = state.summary;
  if (!s) return;
  const r = ranking();
  renderHeadline(r);
  renderRanking(r);
  renderSponsored(r);
  els.consumption.hidden = !!s.quick;
  els.charts.hidden = !state.rows;
  if (!s.quick) renderKpis(s);
  renderInsights(s, r);
  if (state.rows) { renderMonthly(s); renderHeat(s); }
  renderSolar(r);
  const cat = state.catalog;
  els.verified.textContent = state.pvpc || cat
    ? fmt(T.verifiedNote, { date: cat ? dateES(cat.verified) : "—", pvpcDate: state.pvpc ? dateES(state.pvpc.updated) : "—" }) + (state.pvpc ? "" : " " + T.pvpcNone)
    : "";
  els.rulesNote.textContent = fmt(T.rulesNote, { date: RULES.reviewed.split("-").reverse().join("/") });
}

function renderHeadline(r) {
  const best = r[0];
  const h = els.headline;
  h.replaceChildren();
  if (!best) return;
  const label = document.createElement("p");
  label.className = "headline-label";
  label.textContent = T.headlineBest;
  const name = document.createElement("p");
  name.className = "headline-name";
  name.textContent = best.offer.name;
  const cost = document.createElement("p");
  cost.className = "headline-cost";
  cost.textContent = fmt(T.headlinePerYear, { eur: eur(best.perYear) });
  const msg = document.createElement("p");
  msg.className = "headline-msg";
  const cur = r.find((x) => x.offer.id === state.current);
  if (cur && cur.offer.id === best.offer.id) msg.textContent = T.headlineAlready;
  else if (cur) {
    msg.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = fmt(T.headlineSave, { eur: eur(cur.perYear - best.perYear), current: cur.offer.name });
    msg.appendChild(strong);
  } else {
    const avg = r.reduce((a, x) => a + x.perYear, 0) / r.length;
    msg.textContent = fmt(T.headlineUnknown, { eur: eur(avg - best.perYear), n: r.length });
  }
  const sel = document.createElement("select");
  sel.id = "current";
  const lab = document.createElement("label");
  lab.className = "current-label";
  lab.htmlFor = "current";
  lab.textContent = T.currentLabel;
  sel.add(new Option(T.currentUnknown, "unknown"));
  for (const x of allOffers()) sel.add(new Option(x.name, x.id, false, x.id === state.current));
  if (!cur) sel.value = "unknown";
  sel.onchange = () => { state.current = sel.value; store.set("current", state.current); renderAll(); };
  const pick = document.createElement("div");
  pick.className = "current-pick";
  pick.append(lab, sel);
  h.append(label, name, cost, msg, pick);
  if (isSponsored(best.offer)) {
    const a = document.createElement("a");
    a.className = "btn btn-primary";
    a.href = best.offer.affiliateUrl;
    a.target = "_blank";
    a.rel = "sponsored nofollow noopener";
    a.textContent = T.goSponsored;
    h.appendChild(a);
  } else if (best.offer.official) {
    const a = document.createElement("a");
    a.className = "btn btn-primary";
    a.href = best.offer.official;
    a.target = "_blank";
    a.rel = "noopener nofollow";
    a.textContent = T.goOfficial;
    h.appendChild(a);
  }
}

function renderRanking(r) {
  const best = r[0];
  const t = els.ranking;
  t.innerHTML = "";
  const head = t.createTHead().insertRow();
  for (const h of ["#", T.colOffer, T.colYear, T.colMonth, T.colDiff]) {
    const th = document.createElement("th");
    th.textContent = h;
    th.scope = "col";
    head.appendChild(th);
  }
  const body = t.createTBody();
  r.forEach((x, k) => {
    const tr = body.insertRow();
    if (k === 0) tr.className = "best";
    if (x.offer.id === state.current) tr.classList.add("current");
    tr.insertCell().textContent = String(k + 1);
    const nameCell = tr.insertCell();
    nameCell.append(x.offer.name);
    const sub = document.createElement("span");
    sub.className = "offer-sub";
    if (x.offer.kind === "pvpc") sub.textContent = state.rows ? T.pvpcBadge : T.pvpcApprox;
    else if (isSponsored(x.offer)) {
      const tag = document.createElement("span");
      tag.className = "sponsored-tag";
      tag.textContent = T.sponsored;
      const a = document.createElement("a");
      a.href = x.offer.affiliateUrl;
      a.target = "_blank";
      a.rel = "sponsored nofollow noopener";
      a.textContent = T.sponsoredLink;
      sub.append(tag, " ", x.offer.type === "periods" ? `${T.typePeriods} · ` : `${T.typeFixed} · `, a);
    } else if (x.offer.official) {
      const a = document.createElement("a");
      a.href = x.offer.official;
      a.target = "_blank";
      a.rel = "noopener nofollow";
      a.textContent = T.official;
      sub.append(x.offer.type === "periods" ? `${T.typePeriods} · ` : `${T.typeFixed} · `, a);
    } else if (x.offer.custom) sub.textContent = T.myOffer;
    nameCell.appendChild(sub);
    for (const [v, cls] of [[eur(x.perYear), "num"], [eur(x.perMonth), "num"], [k === 0 ? T.best : `+${eur(x.perYear - best.perYear)}`, "num"]]) {
      const td = tr.insertCell();
      td.textContent = v;
      td.className = cls;
    }
  });
}

// Hueco de ofertas patrocinadas: se muestran con su puesto real por precio (nunca se reordena la lista).
function renderSponsored(r) {
  const items = r.map((x, k) => ({ ...x, pos: k + 1 })).filter((x) => isSponsored(x.offer));
  els.sponsored.hidden = !items.length;
  els.sponsoredList.replaceChildren(...items.map((x) => {
    const li = document.createElement("li");
    const tag = document.createElement("span");
    tag.className = "sponsored-tag";
    tag.textContent = T.sponsored;
    const a = document.createElement("a");
    a.href = x.offer.affiliateUrl;
    a.target = "_blank";
    a.rel = "sponsored nofollow noopener";
    a.textContent = x.offer.name;
    li.append(tag, " ", a, " · " + fmt(T.sponsoredRank, { n: x.pos, total: r.length, eur: eur(x.perYear) }));
    return li;
  }));
}

// Precio de la energía (sin impuestos) de una tarifa en una hora concreta.
function priceFn(offer) {
  if (offer.kind === "pvpc") return (d, h) => state.pvpc.days[d]?.[h] ?? state.pvpc.avg365[periodOf(d, h)] ?? 0;
  const e = offer.type === "fixed" ? [offer.energy[0], offer.energy[0], offer.energy[0]] : offer.energy;
  return (d, h) => e[PERIODS.indexOf(periodOf(d, h))];
}

function renderSolar(r) {
  els.solar.hidden = !state.rows;
  if (!state.rows) return;
  const cfg = { ...SOLAR_DEFAULTS, ...(state.catalog?.solar || {}) };
  const ref = (r.find((x) => x.offer.id === state.current) || r[0]).offer;
  // Precio instalado y de excedentes: los de data/ofertas.json salvo que la persona ponga los suyos.
  const own = (k, min, max) => { const v = store.get(k); return typeof v === "number" && v >= min && v <= max ? v : null; };
  const costPerKwp = own("solarCost", 300, 4000) ?? cfg.costPerKwp, surplusPrice = own("solarSurplus", 0, 0.5) ?? cfg.surplusPrice;
  if (document.activeElement !== els.solarCost) els.solarCost.value = costPerKwp;
  if (document.activeElement !== els.solarSurplus) els.solarSurplus.value = surplusPrice;
  const opts = { yearlyYield: cfg.yield[state.solarZone] ?? cfg.yield.centro, costPerKwp, surplusPrice, priceAt: priceFn(ref) };
  const suggested = suggestSize(state.rows, opts, SOLAR_DEFAULTS.sizes);
  const est = state.solarKwp ? solarEstimate(state.rows, { ...opts, kwp: state.solarKwp }) : suggested;
  els.solarZone.value = state.solarZone;
  els.solarSize.replaceChildren(...SOLAR_DEFAULTS.sizes.map((k) => new Option(`${num(k, 1)} kWp${k === suggested.kwp ? ` (${T.solarSuggested})` : ""}`, String(k), false, k === est.kwp)));
  els.solarSaving.textContent = fmt(T.solarSaving, { eur: eur(est.savingYear) });
  els.solarResult.textContent = fmt(T.solarResult, { kwp: num(est.kwp, 1), prod: num(est.production), self: num(est.selfShare * 100), cover: num(est.coverage * 100) }) + " "
    + (Number.isFinite(est.payback) && est.payback < 40 ? fmt(T.solarPayback, { cost: eur(est.cost), years: num(est.payback, est.payback < 10 ? 1 : 0) }) : fmt(T.solarNoPayback, { cost: eur(est.cost) }));
  const tips = [fmt(T.solarSun, { p: num(est.sunShare * 100) })];
  if (est.lostYear >= 5) tips.push(fmt(T.solarLost, { eur: eur(est.lostYear) }));
  else if (surplusPrice > 0 && est.surplus > 0) tips.push(fmt(T.solarBest, { kwp: num(est.kwp, 1) }));
  els.solarTips.replaceChildren(...tips.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
  els.solarMonths.replaceChildren(...est.months.map((m) => {
    const tr = document.createElement("tr");
    [`${MONTHS[Number(m.month.slice(5)) - 1]} ${m.month.slice(0, 4)}`, num(m.consumption), num(m.production), num(m.selfUse), num(m.surplusKwh)].forEach((v, j) => { const c = tr.insertCell(); c.textContent = v; if (j) c.className = "num"; });
    return tr;
  }));
  els.solarNote.textContent = fmt(T.solarNote, { cost: num(costPerKwp), surplus: num(surplusPrice, 2), offer: ref.name });
}

function kpi(label, value, sub) {
  const d = document.createElement("div");
  d.className = "kpi";
  d.innerHTML = `<span class="kpi-label"></span><strong class="kpi-value"></strong><span class="kpi-sub"></span>`;
  d.children[0].textContent = label;
  d.children[1].textContent = value;
  if (typeof sub === "string") d.children[2].textContent = sub;
  else if (sub) d.children[2].replaceWith(sub);
  return d;
}

function renderKpis(s) {
  const split = document.createElement("span");
  split.className = "kpi-sub split";
  for (const p of PERIODS) {
    const it = document.createElement("span");
    it.innerHTML = `<i class="sw sw-${p}"></i>`;
    it.append(`${T[p]} ${num((s.byPeriod[p] / s.kwh) * 100)} %`);
    split.appendChild(it);
  }
  els.kpis.replaceChildren(
    kpi(T.total, `${num(s.kwh)} kWh`, `≈ ${num((s.kwh * 365) / s.nDays)} kWh ${T.perYear}`),
    kpi(T.period, fmt(T.days, { n: num(s.nDays) }), `${dateES(s.first)} – ${dateES(s.last)}`),
    kpi(`${T.P1} / ${T.P2} / ${T.P3}`, "", split),
    kpi(T.baseLoad, `${num(s.baseW)} W`, T.baseLoadHint),
  );
}

function renderInsights(s, r) {
  const list = document.createElement("ul");
  list.className = "insight-list";
  // 1. Mover consumo a valle, con la tarifa por periodos más barata de la lista.
  const periodsOffer = r.find((x) => x.offer.type === "periods")?.offer;
  const li1 = document.createElement("li");
  const label = document.createElement("label");
  label.htmlFor = "shift";
  label.textContent = T.shiftLabel + " ";
  const out = document.createElement("output");
  out.htmlFor = "shift";
  out.textContent = `${state.shiftPct} %`;
  label.appendChild(out);
  const range = document.createElement("input");
  Object.assign(range, { type: "range", id: "shift", min: "0", max: "60", step: "5", value: String(state.shiftPct) });
  const res = document.createElement("p");
  res.className = "insight-result";
  const updateShift = () => {
    state.shiftPct = Number(range.value);
    out.textContent = `${state.shiftPct} %`;
    if (!periodsOffer) { res.textContent = T.shiftNone; return; }
    const before = billFor(s.byPeriod, s.nDays, periodsOffer, state.contract).perYear;
    const after = billFor(shift(s.byPeriod, state.shiftPct / 100), s.nDays, periodsOffer, state.contract).perYear;
    const saving = before - after;
    res.textContent = fmt(saving > 0.005 ? T.shiftResult : T.shiftWorse, { eur: eur(saving), offer: periodsOffer.name });
  };
  range.addEventListener("input", updateShift);
  updateShift();
  li1.append(label, range, res);
  list.appendChild(li1);
  const bestOffer = r[0].offer;
  const flat = bestOffer.kind === "pvpc" ? { type: "periods", energy: PERIODS.map((p) => state.pvpc.avg365[p] ?? 0) } : bestOffer;
  if (!s.quick) {
    const li2 = document.createElement("li");
    li2.textContent = fmt(T.baseResult, { w: num(s.baseW), eur: eur(baseLoadCostPerYear(s.baseW, flat)) });
    const li3 = document.createElement("li");
    li3.append(fmt(T.powerResult, {
      date: dateES(s.maxHour.date), hour: `${String(s.maxHour.hour).padStart(2, "0")}:00`, kwh: num(s.maxHour.kwh, 2),
      kw: num(s.maxHour.kwh, 1), contract: num(state.contract.p1, 2), eur: eur(powerSavingPerYear(bestOffer, 1)),
    }));
    const note = document.createElement("span");
    note.className = "muted small block";
    note.textContent = T.powerNote;
    li3.appendChild(note);
    list.append(li2, li3);
  }
  els.insights.replaceChildren(list);
}

// ---------- gráficos ----------

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

function renderMonthly(s) {
  const months = s.monthList;
  const W = 640, H = 270, L = 44, R = 8, TOP = 26, B = 28;
  const max = niceMax(Math.max(...months.map((m) => m.P1 + m.P2 + m.P3)));
  const y = (v) => TOP + (H - TOP - B) * (1 - v / max);
  const slot = (W - L - R) / months.length;
  const bw = Math.min(40, slot * 0.64);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img", "aria-label": T.monthlyTitle });
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4, yy = y(v);
    root.appendChild(svg("line", { x1: L, x2: W - R, y1: yy, y2: yy, class: k ? "grid" : "axis" }));
    const t = svg("text", { x: L - 6, y: yy + 4, class: "tick", "text-anchor": "end" });
    t.textContent = num(v);
    root.appendChild(t);
  }
  const unit = svg("text", { x: L - 6, y: 10, class: "tick", "text-anchor": "end" });
  unit.textContent = "kWh";
  root.appendChild(unit);
  months.forEach((m, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    let base = 0;
    const g = svg("g", { class: "bar", tabindex: "0", "data-tip": `${MONTHS[Number(m.month.slice(5)) - 1]} ${m.month.slice(0, 4)} · ${PERIODS.map((p) => `${T[p]} ${num(m[p])}`).join(" · ")} kWh` });
    const top = PERIODS.filter((p) => m[p] > 0).at(-1);
    for (const p of PERIODS) {
      if (m[p] <= 0) continue;
      const y1 = y(base + m[p]), y0 = y(base);
      const h = Math.max(0, y0 - y1 - (base > 0 ? 2 : 0)); // 2 px de separación entre segmentos
      if (p === top) {
        const r = Math.min(4, h, bw / 2);
        g.appendChild(svg("path", { class: `seg seg-${p}`, d: `M${x},${y0 - (base > 0 ? 2 : 0)} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0 - (base > 0 ? 2 : 0)} Z` }));
      } else {
        g.appendChild(svg("rect", { class: `seg seg-${p}`, x, y: y1, width: bw, height: h }));
      }
      base += m[p];
    }
    // Zona de interacción más grande que la barra
    g.appendChild(svg("rect", { class: "hit", x: L + slot * i, y: TOP, width: slot, height: H - TOP - B }));
    root.appendChild(g);
    if (months.length <= 14 || i % 2 === 0) {
      const t = svg("text", { x: x + bw / 2, y: H - 8, class: "tick", "text-anchor": "middle" });
      t.textContent = MONTHS[Number(m.month.slice(5)) - 1];
      root.appendChild(t);
    }
  });

  const legend = document.createElement("div");
  legend.className = "legend";
  for (const p of PERIODS) {
    const it = document.createElement("span");
    it.innerHTML = `<i class="sw sw-${p}"></i>`;
    it.append(`${T[p]} (${p})`);
    legend.appendChild(it);
  }
  // Vista en tabla (accesibilidad y lectura exacta)
  const det = document.createElement("details");
  det.className = "data-table";
  const sum = document.createElement("summary");
  sum.textContent = T.dataTable;
  const tbl = document.createElement("table");
  const hr = tbl.createTHead().insertRow();
  for (const h of [T.month, `${T.P1} kWh`, `${T.P2} kWh`, `${T.P3} kWh`, "Total kWh"]) { const th = document.createElement("th"); th.textContent = h; hr.appendChild(th); }
  const tb = tbl.createTBody();
  for (const m of months) {
    const r = tb.insertRow();
    [`${MONTHS[Number(m.month.slice(5)) - 1]} ${m.month.slice(0, 4)}`, num(m.P1), num(m.P2), num(m.P3), num(m.P1 + m.P2 + m.P3)].forEach((v, j) => { const c = r.insertCell(); c.textContent = v; if (j) c.className = "num"; });
  }
  det.append(sum, tbl);
  els.monthly.replaceChildren(legend, root, det);
}

const RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];

function renderHeat(s) {
  let max = 0;
  for (const row of s.heat) for (const v of row) max = Math.max(max, v);
  const grid = document.createElement("div");
  grid.className = "heat";
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", T.heatTitle);
  grid.appendChild(document.createElement("span"));
  for (let h = 0; h < 24; h++) {
    const c = document.createElement("span");
    c.className = "heat-h";
    c.textContent = h % 3 === 0 ? String(h) : "";
    grid.appendChild(c);
  }
  s.heat.forEach((row, d) => {
    const lab = document.createElement("span");
    lab.className = "heat-d";
    lab.textContent = WD[d];
    grid.appendChild(lab);
    row.forEach((v, h) => {
      const c = document.createElement("span");
      c.className = "cell";
      const k = max ? Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 1))) : 0;
      c.style.background = RAMP[k];
      c.tabIndex = -1;
      c.dataset.tip = `${WDL[d]} ${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00 · ${num(v, 2)} kWh`;
      grid.appendChild(c);
    });
  });
  const legend = document.createElement("div");
  legend.className = "heat-legend";
  legend.innerHTML = `<span>0</span><i style="background:linear-gradient(90deg,${RAMP.join(",")})"></i><span></span>`;
  legend.lastChild.textContent = `${num(max, 2)} kWh`;
  els.heat.replaceChildren(grid, legend);
}

// Tooltip compartido para barras y celdas.
function tip(e) {
  const t = e.target.closest?.("[data-tip]");
  if (!t) { els.tip.hidden = true; return; }
  els.tip.textContent = t.dataset.tip;
  els.tip.hidden = false;
  const r = t.getBoundingClientRect();
  const x = e.clientX ?? r.left + r.width / 2, y = e.clientY ?? r.top;
  const tw = els.tip.offsetWidth;
  els.tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tw - 8, x - tw / 2))}px`;
  els.tip.style.top = `${Math.max(8, y - els.tip.offsetHeight - 12) + window.scrollY}px`;
}

// ---------- eventos ----------

function init() {
  if (!window.File || !window.Blob) { setStatus([T.unsupported], "error"); return; }
  if (matchMedia("(pointer: coarse)").matches) els.drop.querySelector("strong").textContent = T.dropTitleTouch;
  els.drop.onclick = () => els.fileInput.click();
  els.drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.fileInput.click(); } };
  els.fileInput.onchange = () => { const f = els.fileInput.files[0]; els.fileInput.value = ""; if (f) loadFile(f); };
  for (const ev of ["dragenter", "dragover"]) els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.remove("over"); });
  els.drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
  els.example.onclick = loadExample;
  els.quickForm.addEventListener("submit", loadQuick);
  els.qValle.addEventListener("input", () => { els.qValleOut.textContent = `${els.qValle.value} %`; });
  if (state.contract?.p1) els.qPower.value = state.contract.p1;

  els.offers.addEventListener("change", onOfferInput);
  els.offers.addEventListener("input", (e) => { if (e.target.type === "number") onOfferInput(e); });
  els.offers.addEventListener("click", (e) => {
    const i = e.target.dataset?.remove;
    if (i == null) return;
    state.mine.splice(Number(i), 1);
    saveMine();
    renderOffers();
    renderAll();
  });
  els.addOffer.onclick = () => {
    state.mine.push({ name: `${T.myOffer} ${state.mine.length + 1}`, type: "fixed", energy: [0.13, 0.13, 0.13], power: [0.09, 0.09], fee: 0 });
    saveMine();
    renderOffers();
    renderAll();
    els.offers.lastElementChild?.querySelector("input")?.focus();
  };
  for (const [el, k] of [[els.pw1, "p1"], [els.pw2, "p2"]]) {
    el.addEventListener("input", () => {
      const v = Number(el.value);
      if (!Number.isFinite(v) || v <= 0) return;
      state.contract[k] = v;
      store.set("contract", state.contract);
      renderAll();
    });
  }
  els.solarSize.addEventListener("change", () => { state.solarKwp = Number(els.solarSize.value); renderAll(); });
  for (const [el, key] of [[els.solarCost, "solarCost"], [els.solarSurplus, "solarSurplus"]]) {
    el.addEventListener("change", () => { store.set(key, el.value === "" ? null : Number(el.value)); state.solarKwp = null; renderAll(); });
  }
  els.solarZone.addEventListener("change", () => { state.solarZone = els.solarZone.value; store.set("solarZone", state.solarZone); state.solarKwp = null; renderAll(); });
  for (const ev of ["mousemove", "focusin"]) els.results.addEventListener(ev, tip);
  els.results.addEventListener("mouseleave", () => { els.tip.hidden = true; });
}

init();
window.__luz = { state, ranking, dataReady, isSponsored };
