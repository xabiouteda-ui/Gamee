# Progreso (sesión autónoma del 28/09/2026)

Resumen rápido para revisar desde el móvil. Se actualiza al final de cada fase.

| Fase | Estado |
|---|---|
| 1. Investigación → `RESEARCH-2.md` | ✅ Hecha |
| 2. Herramienta 1: subtítulos karaoke | ✅ Hecha |
| 3. Herramienta 2: tarifa de luz con tu CSV | ⏳ En curso |
| 4. Mejoras (marca común, SEO Transcribe Libre, rendimiento, accesibilidad) | ⏳ Pendiente |

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

## Qué tienes que hacer tú

- Al final de la sesión: revisa y fusiona la pull request.
- Después de publicar: prueba los subtítulos animados con un vídeo real tuyo (en ordenador y en el móvil) y dime si
  los tiempos por palabra salen bien.
