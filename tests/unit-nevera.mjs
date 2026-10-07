// Pruebas del intermediario de la nevera (sin red: Gemini simulado): node tests/unit-nevera.mjs
import worker, { parseRequest, cleanResult, callGemini, buildPrompt } from "../workers/nevera/worker.js";
let fail = 0;
const ok = (cond, name) => { if (cond) console.log(`✓ ${name}`); else { fail++; console.error(`✗ ${name}`); } };

// Validación de la petición
ok(!parseRequest(null).ok, "rechaza petición vacía");
ok(!parseRequest({ imagen: "data:image/gif;base64,AAAA" }).ok, "rechaza GIF");
ok(parseRequest({ imagen: "data:image/jpeg;base64,QUJD", personas: 3 }).input.personas === 3, "acepta JPEG y personas");
ok(parseRequest({ imagen: "data:image/jpeg;base64,QUJD", personas: 99 }).input.personas === 8, "limita personas a 8");
ok(!parseRequest({ imagen: "data:image/jpeg;base64," + "A".repeat(1_600_000) }).ok, "rechaza foto enorme");
const p = parseRequest({ ingredientes: [" Huevo", "huevo", "", "Patata"] });
ok(p.ok && p.input.ingredients.join() === "huevo,patata", "normaliza y quita duplicados");
ok(!parseRequest({ ingredientes: [] }).ok, "rechaza lista vacía");
ok(buildPrompt({ ingredients: ["huevo"], personas: 1, rapido: true }).includes("1 persona"), "prompt en singular para 1 persona");

// Limpieza de la respuesta
const c = cleanResult({ esComida: true, ingredientes: ["huevo"], recetas: [{ nombre: "Tortilla", minutos: "999", dificultad: "rara", usa: ["huevo"], pasos: ["Batir"] }, {}, {}, {}] });
ok(c.recetas.length === 3 && c.recetas[0].minutos === 240 && c.recetas[0].dificultad === "fácil" && Array.isArray(c.recetas[1].falta), "limpia tipos y límites");

// Llamada a Gemini simulada
const fake = (status, body) => async () => ({ status, ok: status < 300, json: async () => body });
const geminiOk = { candidates: [{ content: { parts: [{ text: JSON.stringify({ esComida: true, ingredientes: ["huevo", "patata"], recetas: [{ nombre: "Tortilla de patatas", descripcion: "La de siempre.", minutos: 35, dificultad: "media", usa: ["huevo", "patata"], falta: [], pasos: ["Pelar", "Freír", "Cuajar"] }] }) }] } }] };
const r1 = await callGemini({ ingredients: ["huevo"], personas: 2 }, { GEMINI_API_KEY: "x" }, fake(200, geminiOk));
ok(r1.status === 200 && r1.result.recetas[0].nombre === "Tortilla de patatas", "devuelve recetas de Gemini");
ok((await callGemini({ ingredients: ["huevo"] }, { GEMINI_API_KEY: "x" }, fake(429, {}))).status === 429, "traduce el límite de Gemini");
ok((await callGemini({ ingredients: ["huevo"] }, { GEMINI_API_KEY: "x" }, fake(200, { candidates: [{ content: { parts: [{ text: "{roto" }] } }] }))).status === 502, "detecta JSON roto");

// El Worker completo: CORS y origen
const env = { GEMINI_API_KEY: "x", ALLOWED_ORIGINS: "https://herramientaslibres.es" };
const req = (origin, method = "POST", body = "{}") => new Request("https://w.example/", { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: method === "POST" ? body : undefined });
ok((await worker.fetch(req("https://malo.com"), env)).status === 403, "bloquea otros orígenes");
ok((await worker.fetch(req("https://herramientaslibres.es", "OPTIONS"), env)).status === 204, "responde al preflight");
ok((await worker.fetch(req("https://herramientaslibres.es", "POST", "{}"), env)).status === 400, "400 sin foto ni ingredientes");
const limited = await worker.fetch(req("https://herramientaslibres.es", "POST", '{"ingredientes":["huevo"]}'), { ...env, PER_IP: { limit: async () => ({ success: false }) } });
ok(limited.status === 429, "aplica el límite por IP");

if (fail) { console.error(`${fail} pruebas fallidas`); process.exit(1); }
console.log("✓ Nevera: todas las pruebas han pasado");
