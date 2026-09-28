// Versión Pro de pago único, sin servidor: una clave de licencia firmada (ECDSA P-256) que se comprueba en el
// navegador con la clave pública de data/pro.json. La clave privada nunca está en el repositorio: la genera y la
// guarda el titular con `node scripts/pro-keys.mjs` (ver README → «Versión Pro»).
//
// Formato de la clave: HL1.<datos en base64url>.<firma en base64url>, con datos = {"v":1,"id":"…","d":"AAAA-MM-DD"}.
// No lleva nombre ni correo: no hay datos personales en la clave.
//
// Como todo corre en el navegador, alguien con conocimientos podría saltarse la comprobación. Es aceptable: la
// clave es para quien quiere pagar y apoyar la web; lo importante es no molestar a nadie con servidores ni cuentas.

const STORE_KEY = "tl.pro.key";

const b64urlToBytes = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

// Separa y valida la forma de la clave (sin comprobar la firma).
export function parseKey(key) {
  const m = String(key || "").trim().match(/^HL1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(m[1])));
    if (data?.v !== 1 || typeof data.id !== "string") return null;
    return { data, signed: new TextEncoder().encode(m[1]), sig: b64urlToBytes(m[2]) };
  } catch { return null; }
}

// true si la firma es de la clave privada correspondiente a publicJwk.
export async function verifyKey(key, publicJwk) {
  const k = parseKey(key);
  if (!k || !publicJwk || !globalThis.crypto?.subtle) return false;
  try {
    const pub = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, k.sig, k.signed);
  } catch { return false; }
}

const storage = {
  get() { try { return localStorage.getItem(STORE_KEY); } catch { return null; } },
  set(v) { try { v ? localStorage.setItem(STORE_KEY, v) : localStorage.removeItem(STORE_KEY); } catch {} },
};

let cfgPromise = null;
export function loadProConfig(url) {
  cfgPromise ||= fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return cfgPromise;
}

// Estado de la licencia en este navegador: { enabled: se vende, active: clave válida, cfg }.
export async function proStatus(url) {
  const cfg = await loadProConfig(url);
  const key = storage.get();
  const active = !!key && await verifyKey(key, cfg?.publicKey);
  return { enabled: cfg?.enabled === true, active, cfg };
}

export async function activate(key, url) {
  const cfg = await loadProConfig(url);
  const ok = await verifyKey(key, cfg?.publicKey);
  if (ok) storage.set(String(key).trim());
  return ok;
}

export function deactivate() { storage.set(null); }
