# Progreso

Resumen para revisar desde el móvil. Lo más reciente, arriba.

## Sesión 3 (28/09/2026, en curso) – luz en 1 clic, subtítulos para creadores, SEO

| Tarea | Estado |
|---|---|
| 1. Luz: resultado en 1 clic con PVPC real y tarifas del mercado | ✅ |
| 2. Subtítulos: presets para Shorts/Reels/TikTok, palabras clave, emojis, móvil, Safari | ✅ |
| 3. SEO: páginas por búsqueda concreta | ✅ |

**1. Luz ✅**
- Subes el CSV (o pulsas «ejemplo», o usas el **cálculo rápido** con kWh/mes + potencia + % en valle) y sale
  **«Tu mejor opción: X»** con su coste anual y, si eliges tu tarifa actual, **«Ahorras ~Y € al año»**.
- Compara el **PVPC con sus precios reales de cada hora** + **6 tarifas de mercado libre** muy contratadas
  (`data/ofertas.json`, editable a mano, cada una con enlace oficial y fecha de verificación 28/09/2026).
- El PVPC lo descarga GitHub Actions **cada día** de la API pública de Red Eléctrica (`scripts/fetch-pvpc.mjs`);
  si falla, se reutiliza el último publicado y la web sigue funcionando.
- Probado con formatos reales de CSV (i-DE/CNMC, e-distribución, Datadis) y end-to-end.

**2. Subtítulos ✅**
- **2 clics** de subir a descargar: empieza sola al elegir el vídeo; botón de descarga bajo la vista previa.
- «Para: TikTok / Reels / Shorts»: texto dentro de la **zona segura** (se ve sombreada en la vista previa, no en el
  vídeo). Vídeos horizontales → **vertical 9:16**.
- **Palabras clave** resaltadas solas (o con `*palabra*`), **emojis automáticos** opcionales, 3 estilos nuevos
  (Marcador, Progresivo, Neón).
- Exportación a 30 fps, con tiempo restante y **Cancelar**. Si el navegador no puede crear vídeo (iPhone antiguo),
  lo avisa y ofrece el SRT. No pude probar en un iPhone real: pruébalo tú.

**3. SEO ✅ (8 páginas nuevas, 34 en total)**
- Luz: **precio de la luz hoy por horas** (hoy y mañana, datos de REE, gráfico y mejor franja; se actualiza sola
  cada día), **¿cuánto gasta un electrodoméstico?** (calculadora) y **PVPC o mercado libre** (con medias reales).
- Subtítulos: **TikTok**, **Reels**, **Shorts** (cada una abre la herramienta ya configurada para esa app),
  **subtítulos en inglés para un vídeo en español** (nueva opción de traducir) y **videopodcasts**.
- Todas enlazadas entre sí, en el sitemap y con datos estructurados de preguntas frecuentes.

**Qué tienes que hacer tú (nuevo)**
- Tras fusionar, en *Actions* lanza «Publicar en GitHub Pages» a mano una vez y comprueba en el log el paso
  «Descargar precios del PVPC» (debe decir cuántos días descargó). Desde este entorno no pude llegar a REE.
- Revisa `data/ofertas.json` de vez en cuando (precios de mercado libre cambian; la fecha está en el fichero).

---

## Sesión 2 (28/09/2026)

| Fase | Estado |
|---|---|
| 1. Investigación → `RESEARCH-2.md` | ✅ Hecha |
| 2. Herramienta 1: subtítulos karaoke | ✅ Hecha |
| 3. Herramienta 2: tarifa de luz con tu CSV | ✅ Hecha |
| 4. Mejoras (marca común, SEO Transcribe Libre, rendimiento, accesibilidad) | ✅ Hecha |

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

## Fase 4 – Mejoras ✅

- **Marca común «Herramientas Libres»** con portada en `/` que agrupa las 3 herramientas (es + en). El transcriptor
  pasa a `/pasar-audio-a-texto/`; ninguna URL antigua se rompe. Menú de herramientas en la cabecera (desplazable
  en móvil) y bloque «Más herramientas gratis» al final de cada herramienta.
- **SEO de Transcribe Libre:** la página de notas de voz ahora apunta a «transcribir audios de WhatsApp» (pasos
  Android/iPhone/ordenador) y hay 3 páginas nuevas: **clases**, **entrevistas** (TFG, periodismo, privacidad) y
  **reuniones** (con plantilla de acta). Enlaces desde la portada del transcriptor. Subtítulos para TikTok ya
  estaba cubierto en la fase 2.
- **Accesibilidad:** auditoría axe-core de las 26 páginas en modo claro y oscuro → **0 problemas** (se corrigieron
  cabeceras de tabla vacías). Queda como prueba (`tests/e2e-a11y.cjs`).
- **Rendimiento:** ≤60 KB por página sin comprimir; IA, vídeo y fuentes solo se cargan al usarlos; imagen para
  redes de 281 KB a 33 KB.
- **Pruebas:** pasan todas (comprobación del sitio, 2 unitarias, 4 end-to-end).

## Qué tienes que hacer tú

1. **Revisar y fusionar la PR** → se publica sola en `https://xabiouteda-ui.github.io/Gamee/`.
2. **Probar con datos reales** (lo único que no se pudo probar aquí, porque este entorno no descarga modelos de IA):
   - Transcribir un audio real y generar subtítulos animados de un vídeo tuyo (ordenador y móvil).
   - Subir tu CSV de Datadis/distribuidora a `/luz/`.
3. **Rellenar los datos del titular** en `site.config.json` (aviso legal, privacidad, contacto) antes de AdSense.
4. **Dominio propio** (necesario para AdSense) y alta en Google Search Console con el `sitemap.xml`.

## Siguientes pasos recomendados (por prioridad)

1. **Comparar con la tarifa regulada (PVPC) en la herramienta de luz**: descargar los precios horarios públicos
   de Red Eléctrica para las fechas del CSV y añadir el PVPC al ranking. Es lo que más piden estos usuarios y el
   tema tiene el CPC más alto. (Hay que comprobar que su API permite peticiones desde el navegador.)
2. **Autoconsumo / placas solares en la luz**: leer la columna de excedentes y calcular la compensación.
3. **Vídeo horizontal → vertical 9:16 automático** en subtítulos animados (reencuadre siguiendo la cara con
   MediaPipe): función de pago en la competencia y buena página SEO propia (idea nº 15 de `RESEARCH-2.md`).
4. **Más estilos de subtítulos** (emojis automáticos, palabra clave resaltada en otro color, fondo por línea) y
   plantillas guardadas.
5. **Leer Excel (.xlsx) de las distribuidoras** en la luz (SheetJS bajo demanda).
6. **Versiones en inglés** de las páginas nuevas del transcriptor (clases, entrevistas, reuniones, WhatsApp).
7. **Página «precio fijo o 3 periodos: ¿qué me conviene?»** y «¿cuánto gasta un electrodoméstico?» (SEO de luz).
8. **Distinguir hablantes** en el transcriptor cuando haya un modelo ligero para navegador.
9. **PWA** (instalable y sin conexión tras la primera visita) para aumentar las visitas recurrentes.
10. **Medir**: Search Console para ver qué búsquedas traen tráfico y priorizar nuevas páginas con datos reales
    (las cifras de demanda de las investigaciones son estimaciones).
