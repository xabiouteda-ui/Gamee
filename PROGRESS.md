# Progreso (sesión autónoma del 28/09/2026)

Resumen rápido para revisar desde el móvil. Se actualiza al final de cada fase.

| Fase | Estado |
|---|---|
| 1. Investigación → `RESEARCH-2.md` | ✅ Hecha |
| 2. Herramienta 1: subtítulos karaoke | ✅ Hecha |
| 3. Herramienta 2: tarifa de luz con tu CSV | ✅ Hecha |
| 4. Mejoras (marca común, SEO Transcribe Libre, rendimiento, accesibilidad) | ⏳ En curso |

## Fase 1 – Investigación ✅

- 17 ideas evaluadas con 7 criterios ponderados (demanda, hueco competitivo, CPC, recurrencia, viabilidad,
  "IA local", mantenimiento). La demanda es **estimada** (sin Keyword Planner), está marcado en el documento.
- **Elegidas:**
  1. **Subtítulos animados tipo karaoke grabados en el vídeo** (4,55/5). La competencia cobra por quitar la
     marca de agua (19 $/mes) o los ha pasado a Pro; nosotros gratis, sin límite y sin subir el vídeo.
  2. **"¿Qué tarifa de luz me conviene?" con el CSV de consumo de tu distribuidora** (4,05/5). Anuncios de
     energía (los más caros), problema 100 % español y recurrente; lo gratis que hay es viejo o pide tus datos.
- Descartadas por saturadas: marca de agua DNI, plusvalía, IRAV, fotos de carnet, separar voz y música…

## Fase 2 – Subtítulos animados ✅

**Dónde:** `/subtitulos-animados/` (es) y `/en/animated-captions/` (en).

- **Qué hace:** subes un vídeo → la IA reconoce cada palabra y cuándo se dice → eliges estilo (Karaoke, Palabra a
  palabra, Caja, Cómic, Clásico) y ajustas fuente, colores, tamaño, posición y palabras por línea con **vista previa
  en directo** → corriges el texto → descargas un **MP4 con los subtítulos grabados** (y/o el SRT). También permite
  cargar un SRT/VTT propio e incrustarlo. Sin marca de agua, sin límite, sin subir el vídeo.
- **Páginas SEO:** portada con comparativa y FAQ; «Incrustar subtítulos SRT en un vídeo»; «Subtítulos para Reels,
  TikTok y Shorts» (zonas seguras por plataforma). Versión inglesa de las dos primeras. Huecos de anuncios
  desactivados. Menú con enlace a la herramienta.
- **Pruebas:** unitarias (`tests/unit-captions.mjs`) y end-to-end (`tests/e2e-captions.cjs`): genera un vídeo real,
  simula solo el reconocimiento de voz, **exporta el vídeo de verdad** y comprueba en los fotogramas del MP4 que los
  subtítulos están grabados, la duración, la resolución y el audio. También móvil, inglés, SRT importado y el modo
  sin tiempos por palabra. Las pruebas anteriores siguen pasando.
- **Sin probar aquí:** el reconocimiento de voz con el modelo real (el entorno no puede descargar modelos). Pruébalo
  en la web publicada con un vídeo tuyo.

## Fase 3 – ¿Qué tarifa de luz me conviene? ✅

**Dónde:** `/luz/` (solo español: la tarifa 2.0TD es española).

- **Qué hace:** subes el CSV de consumo horario de tu distribuidora (o pruebas con un ejemplo) y ves: consumo total
  y anual, reparto punta/llano/valle, consumo base («fantasma») en W y €/año, **ranking de ofertas con impuestos
  incluidos** (las ofertas y precios los pones tú y se guardan), simulador de mover consumo a valle, pista sobre la
  potencia, gráfico mensual por periodos (con tabla) y mapa de calor día×hora. Nada sale del navegador.
- **Páginas SEO:** portada con tabla de periodos y FAQ; «Cómo descargar tu consumo en CSV (Datadis)»;
  «¿Qué potencia de luz contratar?» con tabla de electrodomésticos.
- **Pruebas:** unitarias (`tests/unit-luz.mjs`: periodos, festivos, formatos de CSV, factura calculada a mano) y
  end-to-end (`tests/e2e-luz.cjs`: CSV con reparto conocido, ranking, edición de ofertas, potencia, simulador,
  tooltip, error de fichero, móvil, modo oscuro y que no se hace ninguna petición a terceros). Encontraron y
  corregí un fallo (el simulador podía prometer un «ahorro» negativo).
- **Revisar tú:** los precios de ejemplo (0,13 €/kWh fijo; 0,19/0,125/0,085 por periodos; potencia 0,0877
  €/kW·día) son orientativos; cámbialos en `assets/js/luz/core.js` si quieres otros de referencia.

## Qué tienes que hacer tú

- Al final de la sesión: revisa y fusiona la pull request.
- Después de publicar: prueba los subtítulos animados con un vídeo real tuyo (en ordenador y en el móvil) y dime si
  los tiempos por palabra salen bien.
- Prueba la herramienta de luz con tu propio CSV de Datadis o de tu distribuidora (por si su formato tuviera alguna
  variante que no lea).
