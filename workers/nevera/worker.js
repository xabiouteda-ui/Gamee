// Intermediario de «¿Qué cocino con lo que tengo?» (Cloudflare Worker).
// Recibe la foto de la nevera (JPEG reducido en el navegador) o una lista de ingredientes, llama a Gemini
// Flash-Lite y devuelve ingredientes y recetas en JSON. La clave de Gemini solo existe aquí (secreto
// GEMINI_API_KEY); la web nunca la ve. No se guarda ninguna foto.
//
// Variables (wrangler.toml / secretos):
//   GEMINI_API_KEY   secreto, clave de Google AI Studio
//   GEMINI_MODEL     modelo (por defecto gemini-flash-lite-latest)
//   ALLOWED_ORIGINS  orígenes permitidos, separados por comas
//   PER_IP           enlace de límite de peticiones (opcional; sin él no hay límite por IP)

export const MAX_IMAGE_BYTES = 1_500_000; // tras base64; la web envía ~150-300 KB
export const MAX_INGREDIENTS = 40;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    esComida: { type: "BOOLEAN" },
    ingredientes: { type: "ARRAY", items: { type: "STRING" } },
    recetas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          descripcion: { type: "STRING" },
          minutos: { type: "INTEGER" },
          dificultad: { type: "STRING", enum: ["fácil", "media", "difícil"] },
          usa: { type: "ARRAY", items: { type: "STRING" } },
          falta: { type: "ARRAY", items: { type: "STRING" } },
          pasos: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["nombre", "descripcion", "minutos", "dificultad", "usa", "falta", "pasos"],
      },
    },
  },
  required: ["esComida", "ingredientes", "recetas"],
};

export function buildPrompt({ ingredients, personas = 2, rapido = false, evitar = [] }) {
  const base = [
    "Eres un cocinero de casa español. Respondes siempre en español de España.",
    ingredients
      ? `Estos son los ingredientes que tiene la persona: ${ingredients.join(", ")}.`
      : "Mira la foto (una nevera, una despensa o comida sobre la encimera) y lista los ingredientes que se ven con claridad, en singular y en minúscula (por ejemplo «huevo», «pimiento rojo», «yogur natural»). No inventes lo que no se ve. Si la foto no muestra comida, pon esComida a false y deja las listas vacías.",
    `Propón 3 recetas caseras distintas para ${personas} ${personas === 1 ? "persona" : "personas"} que usen sobre todo esos ingredientes.`,
    rapido ? "Las tres deben estar listas en 20 minutos o menos." : "Varía el tiempo: al menos una rápida (20 minutos o menos).",
    "Da por hecho que hay aceite de oliva, sal, pimienta, agua, ajo y harina; no los pongas en «falta». En «falta» pon solo lo imprescindible que no tiene (como mucho 2 cosas por receta; mejor ninguna).",
    "En «usa» pon los ingredientes de su lista que usa la receta, escritos igual que en la lista.",
    "Entre 4 y 7 pasos por receta, frases cortas con cantidades concretas. «descripcion»: una frase que haga apetecer el plato.",
  ];
  if (evitar.length) base.push(`Ya le has propuesto estas recetas; propón otras distintas: ${evitar.join("; ")}.`);
  return base.join("\n");
}

// Valida y normaliza la petición. Devuelve { ok, error?, input? }.
export function parseRequest(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Petición vacía." };
  const personas = Math.min(8, Math.max(1, Number.parseInt(body.personas, 10) || 2));
  const rapido = body.rapido === true;
  const evitar = Array.isArray(body.evitar) ? body.evitar.map((s) => String(s).trim().slice(0, 80)).filter(Boolean).slice(0, 9) : [];
  if (Array.isArray(body.ingredientes)) {
    const ingredients = [...new Set(body.ingredientes.map((s) => String(s).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, MAX_INGREDIENTS);
    if (!ingredients.length) return { ok: false, error: "Añade al menos un ingrediente." };
    return { ok: true, input: { ingredients, personas, rapido, evitar } };
  }
  if (typeof body.imagen === "string") {
    const m = body.imagen.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return { ok: false, error: "La imagen tiene que ser JPEG, PNG o WebP." };
    if (m[2].length > MAX_IMAGE_BYTES) return { ok: false, error: "La foto es demasiado grande." };
    return { ok: true, input: { image: { mime: `image/${m[1]}`, data: m[2] }, personas, rapido } };
  }
  return { ok: false, error: "Falta la foto o la lista de ingredientes." };
}

// Limpia la respuesta del modelo: tipos correctos y límites razonables.
export function cleanResult(r) {
  const list = (a, n) => (Array.isArray(a) ? a.map((s) => String(s).trim()).filter(Boolean).slice(0, n) : []);
  return {
    esComida: r?.esComida !== false,
    ingredientes: list(r?.ingredientes, MAX_INGREDIENTS),
    recetas: (Array.isArray(r?.recetas) ? r.recetas : []).slice(0, 3).map((x) => ({
      nombre: String(x?.nombre || "Receta").slice(0, 80),
      descripcion: String(x?.descripcion || "").slice(0, 200),
      minutos: Math.min(240, Math.max(1, Number.parseInt(x?.minutos, 10) || 20)),
      dificultad: ["fácil", "media", "difícil"].includes(x?.dificultad) ? x.dificultad : "fácil",
      usa: list(x?.usa, 20),
      falta: list(x?.falta, 4),
      pasos: list(x?.pasos, 10),
    })),
  };
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "https://herramientaslibres.es").split(",").map((s) => s.trim());
  const ok = allowed.includes(origin);
  return {
    ok,
    headers: {
      "Access-Control-Allow-Origin": ok ? origin : allowed[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function callGemini(input, env, fetchImpl = fetch) {
  const model = env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const parts = [{ text: buildPrompt({ ingredients: input.ingredients, personas: input.personas, rapido: input.rapido, evitar: input.evitar || [] }) }];
  if (input.image) parts.push({ inlineData: { mimeType: input.image.mime, data: input.image.data } });
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });
  if (res.status === 429) return { status: 429, error: "Hoy ya se han cocinado muchas recetas. Vuelve a intentarlo dentro de un rato." };
  if (!res.ok) return { status: 502, error: "La IA no ha podido responder. Prueba otra vez en unos segundos." };
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  try {
    return { status: 200, result: cleanResult(JSON.parse(text)) };
  } catch {
    return { status: 502, error: "La respuesta de la IA ha llegado incompleta. Prueba otra vez." };
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });
    if (request.method !== "POST") return json({ error: "Usa POST." }, 405, cors.headers);
    if (!cors.ok) return json({ error: "Origen no permitido." }, 403, cors.headers);
    if (!env.GEMINI_API_KEY) return json({ error: "Falta configurar la clave de la IA." }, 500, cors.headers);

    if (env.PER_IP) {
      const ip = request.headers.get("CF-Connecting-IP") || "anon";
      const { success } = await env.PER_IP.limit({ key: ip });
      if (!success) return json({ error: "Has hecho muchas consultas seguidas. Espera un minuto y vuelve a probar." }, 429, cors.headers);
    }

    const len = Number(request.headers.get("Content-Length") || 0);
    if (len > MAX_IMAGE_BYTES + 10_000) return json({ error: "La foto es demasiado grande." }, 413, cors.headers);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Petición no válida." }, 400, cors.headers); }
    const parsed = parseRequest(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors.headers);

    const out = await callGemini(parsed.input, env);
    return out.result ? json(out.result, 200, cors.headers) : json({ error: out.error }, out.status, cors.headers);
  },
};
