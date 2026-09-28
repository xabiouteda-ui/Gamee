// Calculadora de lo que gasta un electrodoméstico: kWh y euros al día, al mes y al año.
import { RULES, PERIODS } from "./core.js";

// Valores típicos ORIENTATIVOS: potencia media real (en neveras y termos, el motor/resistencia no está siempre
// encendido, por eso se da una potencia media) y horas de uso diarias habituales.
export const APPLIANCES = [
  ["Nevera / frigorífico (media real)", 35, 24], ["Lavadora (1 lavado al día)", 1000, 1], ["Lavavajillas (1 al día)", 1100, 1],
  ["Secadora", 2500, 1], ["Horno", 2000, 0.5], ["Vitrocerámica / inducción", 1500, 1], ["Microondas", 1000, 0.2],
  ["Termo eléctrico (media real)", 1500, 2], ["Aire acondicionado", 900, 4], ["Radiador o estufa eléctrica", 1500, 4],
  ["Bomba de calor (calefacción)", 700, 5], ["Televisión", 100, 4], ["Ordenador de sobremesa", 150, 6], ["Portátil", 45, 6],
  ["Router wifi", 10, 24], ["Bombilla LED", 9, 5], ["Secador de pelo", 1800, 0.15], ["Plancha", 2000, 0.3],
  ["Aparatos en espera (standby)", 15, 24], ["Otro (escribe la potencia)", 100, 1],
];

// Coste con impuestos (impuesto eléctrico + IVA) de unos kWh a un precio sin impuestos.
export function costWithTaxes(kwh, price) {
  return kwh * price * (1 + RULES.electricityTax) * (1 + RULES.vat);
}

// Precio medio del PVPC del último año (ponderado por horas de cada periodo en una semana).
export function pvpcAverage(avg) {
  if (!avg || PERIODS.some((p) => avg[p] == null)) return null;
  return ((avg.P1 + avg.P2 + avg.P3) / 3) * (5 / 7) + avg.P3 * (2 / 7);
}

const $ = (id) => document.getElementById(id);
const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n, d = 2) => n.toLocaleString("es-ES", { maximumFractionDigits: d });

async function init() {
  const app = $("g-app");
  if (!app) return;
  APPLIANCES.forEach(([name], i) => app.add(new Option(name, String(i))));
  const fill = () => { const a = APPLIANCES[Number(app.value)]; $("g-w").value = a[1]; $("g-h").value = a[2]; calc(); };
  const calc = () => {
    const w = Number($("g-w").value), h = Number($("g-h").value), d = Number($("g-d").value), p = Number($("g-p").value);
    if (!(w > 0) || !(h >= 0) || !(d > 0) || !(p > 0)) return;
    const day = (w / 1000) * h;
    const month = day * d, year = month * 12;
    $("g-result").innerHTML = "";
    for (const [label, kwh] of [["Al día", day], ["Al mes", month], ["Al año", year]]) {
      const div = document.createElement("div");
      div.className = "kpi";
      div.innerHTML = '<span class="kpi-label"></span><strong class="kpi-value"></strong><span class="kpi-sub"></span>';
      div.children[0].textContent = label;
      div.children[1].textContent = eur(costWithTaxes(kwh, p));
      div.children[2].textContent = `${num(kwh)} kWh`;
      $("g-result").appendChild(div);
    }
    $("g-note").textContent = `Cálculo: ${num(w, 0)} W × ${num(h)} h = ${num(day, 3)} kWh al día. Incluye impuesto eléctrico e IVA; no incluye la potencia contratada, que pagas igual aunque no enciendas nada. Los valores de cada aparato son orientativos: mira la etiqueta del tuyo.`;
  };
  app.addEventListener("change", fill);
  for (const id of ["g-w", "g-h", "g-d", "g-p"]) $(id).addEventListener("input", calc);
  $("g-p").value = "0.15";
  $("g-p-src").textContent = "Precio orientativo. Pon el de tu factura.";
  try {
    const r = await fetch(new URL("../../../data/pvpc.json", import.meta.url));
    if (r.ok) {
      const avg = pvpcAverage((await r.json()).avg365);
      if (avg) { $("g-p").value = avg.toFixed(3); $("g-p-src").textContent = "Precio medio del PVPC en el último año (Red Eléctrica). Cámbialo por el de tu tarifa."; }
    }
  } catch {}
  fill();
}

if (typeof document !== "undefined") init();
