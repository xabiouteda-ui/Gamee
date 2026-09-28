// Recomendaciones con enlace de afiliado en las pantallas de resultado (data/afiliados.json).
// Desactivadas por defecto: sin enlaces configurados no se muestra nada y no se hace ninguna petición a terceros.

const LABEL = { es: "Enlace de afiliado", en: "Affiliate link" };
const HEADING = { es: "Siguiente paso, si lo necesitas", en: "Next step, if you need it" };
const NOTE = {
  es: "Si contratas desde estos enlaces podemos recibir una comisión, sin coste para ti. Así seguimos siendo gratis.",
  en: "If you sign up through these links we may earn a commission at no cost to you. It keeps these tools free.",
};

// Elige las recomendaciones válidas para una pantalla ("subtitulos" | "transcripcion") y un idioma.
export function pickAffiliates(cfg, where, lang) {
  if (!cfg || cfg.enabled !== true || !Array.isArray(cfg.items)) return [];
  return cfg.items
    .filter((it) => it && it.enabled === true && /^https:\/\/[^\s"<>]+$/.test(it.url || "")
      && (it.where || []).includes(where) && (!it.lang || it.lang.includes(lang)) && it[lang]?.title)
    .slice(0, Math.max(0, cfg.max ?? 3));
}

let cache = null;
export function loadAffiliates(url) {
  cache ||= fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return cache;
}

// Rellena el contenedor (un <aside hidden>) con las recomendaciones; si no hay ninguna, lo deja oculto.
export async function showAffiliates(el, where, lang, dataUrl) {
  if (!el) return;
  const items = pickAffiliates(await loadAffiliates(dataUrl), where, lang);
  if (!items.length) { el.hidden = true; return; }
  const h = document.createElement("h2");
  h.textContent = HEADING[lang];
  const list = document.createElement("ul");
  list.className = "aff-list";
  for (const it of items) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = it.url;
    a.target = "_blank";
    a.rel = "sponsored nofollow noopener";
    const strong = document.createElement("strong");
    strong.textContent = it[lang].title;
    const text = document.createElement("span");
    text.textContent = `${it[lang].text}${it.provider ? ` (${it.provider})` : ""}`;
    a.append(strong, text);
    const tag = document.createElement("span");
    tag.className = "aff-tag";
    tag.textContent = LABEL[lang];
    li.append(a, tag);
    list.appendChild(li);
  }
  const note = document.createElement("p");
  note.className = "muted small";
  note.textContent = NOTE[lang] + " ";
  const more = document.createElement("a");
  more.href = el.dataset.moneyHref || "";
  more.textContent = lang === "es" ? "Cómo ganamos dinero" : "How we make money";
  if (el.dataset.moneyHref) note.appendChild(more);
  el.replaceChildren(h, list, note);
  el.hidden = false;
}
