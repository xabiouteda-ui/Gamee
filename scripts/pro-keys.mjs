// Claves de licencia de la versión Pro (ver README → «Versión Pro»).
//
//   node scripts/pro-keys.mjs init        Crea el par de claves: guarda la PRIVADA en pro-private-key.json (no se sube
//                                         a git, está en .gitignore) y escribe la pública en data/pro.json.
//   node scripts/pro-keys.mjs issue [n]   Genera n claves de licencia (1 por defecto) para enviar a quien compra.
//
// La clave privada también puede venir en la variable PRO_PRIVATE_KEY (el JSON entero), p. ej. desde un gestor
// de contraseñas. Guárdala en un sitio seguro: sin ella no se pueden emitir más claves; si se filtra, cualquiera
// podría emitirlas (en ese caso ejecuta `init` de nuevo y las claves antiguas dejarán de valer).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto, randomBytes } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIV = join(ROOT, "pro-private-key.json");
const CFG = join(ROOT, "data", "pro.json");
const b64url = (buf) => Buffer.from(buf).toString("base64url");

export async function issueKey(privateJwk, id = randomBytes(9).toString("base64url"), date = new Date().toISOString().slice(0, 10)) {
  const priv = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const data = b64url(JSON.stringify({ v: 1, id, d: date }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, new TextEncoder().encode(data));
  return `HL1.${data}.${b64url(sig)}`;
}

export async function newKeyPair() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicJwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, privateJwk: priv };
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "init") {
    if (existsSync(PRIV) && arg !== "--force") {
      console.error("Ya existe pro-private-key.json. Usa `init --force` para sustituirla (las claves emitidas dejarán de valer).");
      process.exit(1);
    }
    const { publicJwk, privateJwk } = await newKeyPair();
    writeFileSync(PRIV, JSON.stringify(privateJwk, null, 2) + "\n", { mode: 0o600 });
    const cfg = JSON.parse(readFileSync(CFG, "utf8"));
    cfg.publicKey = publicJwk;
    writeFileSync(CFG, JSON.stringify(cfg, null, 2) + "\n");
    console.log("Clave privada guardada en pro-private-key.json (NO la subas a git; guárdala también en tu gestor de contraseñas).");
    console.log("Clave pública escrita en data/pro.json → haz commit de ese archivo.");
  } else if (cmd === "issue") {
    const raw = process.env.PRO_PRIVATE_KEY || (existsSync(PRIV) ? readFileSync(PRIV, "utf8") : null);
    if (!raw) { console.error("Falta la clave privada: ejecuta antes `node scripts/pro-keys.mjs init`."); process.exit(1); }
    const n = Math.max(1, Math.min(1000, Number(arg) || 1));
    for (let i = 0; i < n; i++) console.log(await issueKey(JSON.parse(raw)));
  } else {
    console.log("Uso: node scripts/pro-keys.mjs init | issue [n]");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
