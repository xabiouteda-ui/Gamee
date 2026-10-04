# Progreso

Resumen para revisar desde el móvil. Lo más reciente, arriba.

## Sesión 6 (04/10/2026) – más páginas que atraen visitas (en curso)

El backlog de la sesión 5 estaba terminado, así que lo he ampliado con lo que más visitas puede traer en otoño.

| Bloque | Estado |
|---|---|
| 1. Horario de la luz: punta, llano y valle | ✅ |
| 2. Coste de calefacción, secadora, lavavajillas y termo | ⏳ |
| 3. Más búsquedas de transcripción y subtítulos | ⏳ |

**1. Horario de la luz ✅** Nueva página `/luz/horarios-luz-punta-llano-valle.html`: dice en qué tramo estamos
ahora, hasta cuándo dura, las franjas de hoy y mañana y el precio medio real del PVPC en cada tramo. Tabla de
horarios, Ceuta y Melilla, festivos que cuentan y potencia. Fuente: Circular 3/2020 de la CNMC.

**Sigue pendiente de ti** (igual que en la sesión 5): *Enforce HTTPS* en GitHub Pages, Search Console y Bing,
mensaje de consentimiento y `ca-pub` de AdSense, código de GoatCounter si lo quieres y el bot de Telegram.
Ojo: en `site.config.json` → `ownerAddress` solo hay un código postal (36205); el aviso legal (LSSI) pide una
dirección completa.

---

## Sesión 5 (29/09/2026) – dominio, SEO y marketing (terminada: PR #4 lista para fusionar)

| Bloque | Estado |
|---|---|
| 0. Dominio herramientaslibres.es | ✅ |
| 1. SEO técnico | ✅ |
| 2. Contenido de cola larga | ✅ |
| 3. Carpeta /marketing | ✅ |
| 4. Medición y AdSense | ✅ (con tareas tuyas) |
| 5. Extras | ✅ |

**0. Dominio ✅** Todo (canonical, sitemap, OG, 404, widget, crédito, Telegram) usa `https://herramientaslibres.es`.
El despliegue manual del 28/09 **falló** por la URL antigua en `site.config.json`: se arregla al fusionar esta PR.
`robots.txt` y `ads.txt` en la raíz. El aviso del workflow era porque Pages aún sirve **http**: activa
*Settings → Pages → Enforce HTTPS*.

**1. SEO técnico ✅** Resumen en `marketing/auditoria-seo.md`. Títulos más cortos y con una sola marca, migas de pan
y «Guías relacionadas» en cada página, imagen para redes propia por página, sitemap con fechas reales, IndexNow
automático, datos estructurados (Organization, BreadcrumbList, Dataset del PVPC).

**2. Contenido ✅ (9 páginas nuevas, 48 en total)**
- Luz: **precio de la luz mañana**, **¿cuánto cuesta poner la lavadora / el horno / el aire hoy?** (coste a cada
  hora con los precios reales), **mejor hora para cargar el coche eléctrico** y el **estudio «las horas más
  baratas de la luz en 2026»** (gráficos, tabla mes a mes y CSV; se rehace solo cada día). Todas con el recuadro
  de Telegram.
- Subtítulos: **karaoke**, **alternativa gratis a CapCut**, **sin marca de agua**; «Reels» ahora es «cómo poner
  subtítulos a un Reel».
- Transcripción: las páginas de WhatsApp y de clases grabadas ya existían; les he ajustado título y H1.

**3. Marketing ✅** Todo en `marketing/` (empieza por `marketing/README.md`): plan de 8 semanas, foros, directorios
con los formularios rellenos, 18 medios con contacto público y 2 emails, 10 guiones de Shorts, Product Hunt y
Show HN, Telegram y afiliados. Logo y capturas en `marketing/assets/`.

**4. Medición y AdSense ✅**
- **GoatCounter** listo y apagado: pon tu código en `site.config.json` → `goatcounter`. Sin cookies. Su plan gratis
  es para webs no comerciales: con anuncios toca plan de pago (pocos $/mes; compruébalo).
- **Huecos de anuncios sin saltos** (alto fijo y reservado desde el HTML). ads.txt en la raíz.
- Checklist AdSense: páginas legales ✅, contenido en cada herramienta ✅ (todas >450 palabras), huecos sin CLS ✅,
  dominio propio ✅. **Te toca:**
  1. Rellenar en `site.config.json` tu nombre, NIF, dirección y email (hoy hay «[TU NOMBRE…]»: AdSense rechaza la
     web así).
  2. En AdSense → *Privacidad y mensajes → Europa*: crear y publicar el mensaje de consentimiento (CMP de Google).
  3. Poner tu `ca-pub-…` y los IDs de bloque en `assets/js/config.js` y `adsEnabled: true` cuando te aprueben.

**5. Extras** ✅ 5 páginas en inglés (karaoke, alternativa a CapCut, sin marca de agua, WhatsApp, clases grabadas),
enlazadas con su versión en español. 53 páginas en total.
Subtítulos: al pasar un vídeo horizontal a 9:16 hay una casilla nueva **«Seguir la cara»**: el recorte se mueve con
quien habla (se analiza en el navegador; sin subir el vídeo).
Luz: el bloque de **placas solares** deja poner tu precio por kWp y el de tus excedentes, muestra el mes a mes,
cuánto consumes en horas de sol y cuánto dinero de excedentes perderías si pones demasiada potencia.

---

## Sesión 4 (28/09/2026) – monetización más allá de AdSense

| Tarea del plan | Estado |
|---|---|
| 1. Afiliados en pantallas de resultado | ✅ (desactivados) |
| 2. Pro de pago único con clave de licencia | ✅ (desactivado) |
| 3. Crédito «Hecho con Herramientas Libres» | ✅ (activado, se puede quitar) |
| 4. Luz: orden por precio, patrocinados, «Cómo ganamos dinero», placas solares | ✅ |
| 5. Telegram: precio de mañana a las 20:40 | ✅ (falta crear el bot) |
| 6. Widget «precio de la luz hoy» | ✅ |

**Qué cambia para quien visita la web hoy (con todo lo de pago desactivado)**
- Los vídeos exportados llevan un crédito pequeño «Hecho con Herramientas Libres» arriba; se quita con una casilla.
- En la luz, tras analizar el CSV: bloque **«¿Te salen a cuenta las placas solares?»** con ahorro al año y años para
  recuperar la inversión (orientativo, sin pedir datos). Nota de que la lista va ordenada por precio.
- Página **«Cómo ganamos dinero»** en el pie de todas las páginas.
- Página del **widget** (`/luz/widget-precio-luz.html`), enlazada desde «precio de la luz hoy».

**Preparado pero apagado (se activa editando un archivo, ver README → «Monetización»)**
- **Afiliados** (`data/afiliados.json`): doblaje/voz, clips, música, transcripción revisada, traducción. Sin enlaces.
- **Ofertas patrocinadas** en la luz (`data/ofertas.json`): marcadas y sin cambiar de puesto.
- **Pro** (`data/pro.json` + `scripts/pro-keys.mjs`): fuentes propias, kit de marca, 2 estilos extra, 4K, varios
  vídeos seguidos, Word. Página `/pro.html` (sin indexar hasta que lo actives). **No he puesto precio**: lo decides tú.
- **Telegram**: el workflow corre cada día y no publica nada hasta que existan los secretos.

**Calidad:** `bash tests/run-all.sh` pasa entero (39 páginas, 4 unitarias, 4 e2e, accesibilidad claro/oscuro).
Nuevo: `tests/unit-monetizacion.mjs` (12 pruebas) y casos e2e para afiliados, patrocinados, placas, crédito en el
vídeo exportado, Pro (bloqueado, activado, kit de marca, fuente, lote de 2 vídeos, Word) y widget. También corregí
una prueba de la luz que fallaba entre las 22:00 y las 24:00 UTC (la fecha de Madrid ya era la del día siguiente).

**Qué tienes que hacer tú**
1. **Revisar y fusionar el PR.**
2. **Telegram:** crear el bot y el canal y poner los secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (README →
   «Canal de Telegram»). Luego *Run workflow* una vez después de las 20:30.
3. **Afiliados:** darte de alta en los programas que quieras y pegar tus enlaces en `data/afiliados.json`.
4. **Pro, cuando quieras venderlo:** cuenta en Paddle o Stripe, `node scripts/pro-keys.mjs init`, precio y enlace de
   pago en `data/pro.json`. Consulta a un gestor lo del alta de autónomo antes de cobrar.
5. Revisar si te gustan los valores de las placas (`data/ofertas.json` → `solar`: 1.300 €/kWp, 0,06 €/kWh).

**No probado aquí:** un bot real de Telegram (se probó contra un servidor que lo simula) ni un pago real.

---

## Sesión 3 (28/09/2026) – luz en 1 clic, subtítulos para creadores, SEO

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

**Calidad:** todas las pruebas pasan (`bash tests/run-all.sh`: 34 páginas, unitarias, 4 e2e y accesibilidad).
Un push intermedio salió con la auditoría de accesibilidad en rojo (fallo real: un selector de plataformas
alcanzaba la sección entera); se corrigió en el siguiente commit y ahora hay un script que para en el primer fallo.

**Qué tienes que hacer tú**
1. **Fusionar la PR #2.** Después, en *Actions* → «Publicar en GitHub Pages» → *Run workflow* una vez, y mira el
   paso «Descargar precios del PVPC»: debe decir cuántos días descargó. Desde aquí no pude conectar con Red
   Eléctrica; si falla, la web funciona igual (sin PVPC) y me lo dices.
2. **Probar con cosas reales:** tu CSV de consumo en `/luz/`, un vídeo tuyo en `/subtitulos-animados/` (también en el
   iPhone) y `/luz/precio-luz-hoy.html` al día siguiente de fusionar.
3. **Revisar `data/ofertas.json`** cada mes o dos (los precios del mercado libre cambian; cada tarifa tiene su
   fuente y fecha). Si quieres más tarifas, añádelas copiando una entrada.
4. Pendiente de antes: datos del titular, dominio propio y Search Console (necesarios para AdSense).

**Siguiente en el backlog (no empezado para no pasarme del presupuesto)**
- Reencuadre automático a 9:16 siguiendo la cara (ahora es recorte centrado).
- Autoconsumo/placas en la luz (columna de vertido ya se ignora correctamente).
- Versiones en inglés de las páginas nuevas del transcriptor y de subtítulos.

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
