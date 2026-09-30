// Pruebas unitarias de la lógica de subtítulos (Node, sin dependencias): `node tests/unit-captions.mjs`.
import assert from "node:assert/strict";
import { segmentsToWords, groupWords, retimeLine, parseSubtitles, linesToSRT, activeLine, faceSampleTimes, mainFaceX, smoothFaceTrack, cropAt } from "../assets/js/captions/core.js";

// Reparto de tiempos por palabra: orden, dentro del segmento y proporcional a la longitud.
const w = segmentsToWords([{ start: 0, end: 3, text: "Hola a todos. Bienvenidos al canal de hoy" }]);
assert.equal(w.length, 8);
assert.equal(w[0].start, 0);
assert.ok(Math.abs(w.at(-1).end - 3) < 1e-9);
assert.ok(w.every((x, i) => i === 0 || x.start >= w[i - 1].start));
assert.ok(w[3].end - w[3].start > w[1].end - w[1].start, "«Bienvenidos» dura más que «a»");

// Agrupación: máximo de palabras, corte tras punto, fin de línea sin pisar a la siguiente.
const L = groupWords(w, { maxWords: 3 });
assert.deepEqual(L.map((l) => l.text), ["Hola a todos.", "Bienvenidos al canal", "de hoy"]);
assert.ok(L.every((l, i) => !L[i + 1] || l.end <= L[i + 1].start + 1e-9));
assert.ok(L.every((l) => Number.isFinite(l.end)));
assert.equal(activeLine(L, 1.5).text, "Bienvenidos al canal");
assert.equal(activeLine(L, 99), null);
assert.equal(activeLine(L, -1), null);

// Pausas largas cortan línea.
const gap = groupWords([{ text: "uno", start: 0, end: 0.4 }, { text: "dos", start: 2, end: 2.4 }], { maxWords: 5 });
assert.equal(gap.length, 2);

// Editar una línea mantiene su inicio y reparte el tiempo.
const r = retimeLine(L[0], "Hola gente");
assert.deepEqual(r.words.map((x) => x.text), ["Hola", "gente"]);
assert.equal(r.words[0].start, L[0].start);

// SRT/VTT: etiquetas fuera, formatos de hora con y sin horas, BOM.
const segs = parseSubtitles("﻿WEBVTT\n\n00:00.500 --> 00:02.000\n<b>Hola</b> mundo\n\n2\n00:00:02,000 --> 00:00:04,250\nSegunda\nlínea\n\nbasura sin tiempos\n");
assert.deepEqual(segs, [{ start: 0.5, end: 2, text: "Hola mundo" }, { start: 2, end: 4.25, text: "Segunda línea" }]);

// Las líneas de un SRT importado se respetan aunque sean largas.
const cues = groupWords(segmentsToWords([{ start: 0, end: 2, text: "Una línea bastante larga del archivo original" }, { start: 2, end: 3, text: "Otra" }], { keepCues: true }), { maxWords: 3 });
assert.deepEqual(cues.map((l) => l.text), ["Una línea bastante larga del archivo original", "Otra"]);
assert.equal(retimeLine(cues[0], "Corta").words[0].cue, 0, "editar conserva la línea original");

// Exportación SRT.
const srt = linesToSRT(L, true);
assert.ok(srt.startsWith("1\n00:00:00,000 --> "));
assert.ok(srt.includes("\nHOLA A TODOS.\n"));

// Reencuadre siguiendo la cara (vídeo 1920×1080 → recorte de 608 px de ancho).
assert.equal(faceSampleTimes(3).length, 6);
assert.equal(faceSampleTimes(600).length, 240, "vídeos largos: como mucho 240 muestras");
assert.equal(mainFaceX([{ boundingBox: { originX: 0, width: 10, height: 10 } }, { boundingBox: { originX: 1000, width: 200, height: 200 } }]), 1100, "sigue la cara más grande");
assert.equal(mainFaceX([]), null);
assert.equal(smoothFaceTrack([{ t: 0, x: null }], 1920, 608), null, "sin caras no hay recorrido (recorte centrado)");
const still = smoothFaceTrack([0, 0.5, 1, 1.5].map((t, i) => ({ t, x: 1500 + (i % 2) * 40 })), 1920, 608);
assert.ok(still.every((s) => s.p === still[0].p), "una cara casi quieta no hace bailar el recorte");
assert.ok(still[0].p > 0.8, "el recorte se va a la derecha, donde está la cara");
const edge = smoothFaceTrack([{ t: 0, x: 1910 }, { t: 1, x: 10 }], 1920, 608, { win: 1 });
assert.deepEqual(edge.map((s) => s.p), [1, 0], "nunca se sale del vídeo");
const gaps = smoothFaceTrack([{ t: 0, x: null }, { t: 1, x: 400 }, { t: 2, x: null }], 1920, 608, { win: 1, dead: 0 });
assert.ok(gaps.every((s) => s.p === gaps[1].p), "sin cara se mantiene la posición más cercana");
assert.equal(cropAt([{ t: 0, p: 0 }, { t: 2, p: 1 }], 1), 0.5, "interpola entre muestras");
assert.equal(cropAt([{ t: 0, p: 0.2 }], 9), 0.2);
assert.equal(cropAt(null, 3), 0.5, "sin recorrido, centrado");

console.log("✓ Pruebas unitarias de subtítulos correctas.");
