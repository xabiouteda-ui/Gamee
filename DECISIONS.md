# Decisiones tomadas

Registro de las decisiones tomadas de forma autónoma durante el desarrollo, con su motivo.

## Producto

1. **Herramienta elegida: transcriptor de audio/vídeo a texto con subtítulos (SRT/VTT)**, usando Whisper en el
   navegador. Mayor puntuación en `RESEARCH.md` (4,35/5): demanda muy alta en español, competidores con límites
   duros o de pago, coste cero por usuario y mucho tiempo en página (bueno para anuncios).
2. **Nombre: "Transcribe Libre"** (dominio sugerido `transcribelibre`). Nombre genérico y descriptivo, sin
   parecido con marcas de competidores. Se cambia en un único sitio (`site.config.json`).
3. **Sin marcas de terceros en la web.** Aunque es habitual decir "transcribe audios de <app de mensajería>", no
   se nombra ninguna marca ni se usan logos: se habla de "notas de voz" y de formatos (`.opus`, `.ogg`, `.m4a`…).
   En `RESEARCH.md` sí se nombran competidores porque es un documento interno.
4. **Funciones incluidas en la v1:** subir archivo (arrastrar o elegir), grabar con el micrófono, elegir idioma
   (o detección automática), elegir calidad del modelo, opción de traducir al inglés, ver el texto mientras se
   genera, editar, copiar y descargar en TXT, SRT y VTT. Se deja fuera la diarización (quién habla) porque no hay
   modelo ligero y fiable para navegador.
5. **Tres calidades de modelo** (`onnx-community/whisper-tiny`, `-base`, `-small`): rápido/equilibrado/preciso.
   Por defecto "equilibrado" en ordenador y "rápido" en móvil (menos memoria).

## Técnica

6. **Sin framework ni bundler.** HTML + CSS + JS modernos (módulos ES). Menos peso, más rápido, sin dependencias
   que mantener. El único paso de "build" es un script de Node sin dependencias (`build.mjs`) que monta las páginas
   a partir de plantillas (cabecera, pie, SEO, hreflang) y genera `sitemap.xml`, `robots.txt` y `ads.txt`.
   Así se evita copiar a mano la cabecera en 12 páginas y se asegura que el SEO es coherente.
7. **Transformers.js 4.3.0 cargado desde jsDelivr, con versión fijada.** Evita subir ~25 MB de WASM al repositorio.
   Los modelos se descargan del CDN de Hugging Face y se cachean en el navegador (Cache API) automáticamente.
8. **La IA corre en un Web Worker** para que la página no se congele. WebGPU si está disponible (mucho más rápido);
   si no, WebAssembly.
9. **Decodificación de audio con la Web Audio API** (`decodeAudioData` a 16 kHz mono) en lugar de ffmpeg.wasm:
   0 KB extra y soporta MP3, WAV, M4A/AAC, OGG/Opus, FLAC, WebM y el audio de MP4/MOV en navegadores modernos.
10. **Troceado propio en fragmentos de ~30 s cortando en el punto más silencioso** (entre los segundos 20 y 30 de
    cada ventana). Permite mostrar progreso real y texto parcial, y evita cortar palabras por la mitad.
11. **No se activa "cross-origin isolation"** (COOP/COEP). GitHub Pages no permite cabeceras propias y el truco del
    service worker rompería los anuncios de AdSense (sus iframes no cumplen COEP). Consecuencia: WASM en un solo
    hilo cuando no hay WebGPU. Se acepta.
12. **Idiomas:** español en la raíz (`/`) e inglés en `/en/`, con `hreflang` y selector de idioma. Los textos de la
    interfaz de la herramienta están en `assets/js/i18n.js`.
13. **Tema claro/oscuro automático** según el sistema, sin botón (menos código, menos cosas que fallar).
14. **Sin cookies ni analítica propia.** Con los anuncios desactivados la web no guarda nada salvo preferencias en
    `localStorage` (idioma del audio y calidad elegida) y el modelo en la caché del navegador.

## Anuncios (AdSense)

15. **Anuncios desactivados por defecto.** `assets/js/config.js` tiene `adsEnabled: false` y `adsenseClient: ""`.
    Los huecos (`.ad-slot`) no ocupan espacio mientras estén desactivados, para no penalizar el diseño ni el CLS.
16. **Cuatro huecos:** debajo de la cabecera, junto al resultado (el usuario mira ahí mientras espera), en mitad del
    contenido y antes del pie. Los huecos se reservan con altura mínima solo cuando los anuncios están activos.
17. **`ads.txt` se genera en el build** a partir del ID de `config.js` (si está vacío no se genera).
18. **Consentimiento (RGPD):** para el Espacio Económico Europeo y Reino Unido Google exige una CMP certificada.
    Decisión: usar la CMP gratuita de Google ("Privacidad y mensajes" en AdSense), que no necesita código extra.
    Documentado en el README y mencionado en la política de privacidad.

## Legal

19. **Páginas legales genéricas con marcadores** (`[TU NOMBRE]`, `[TU EMAIL]`…) centralizados en
    `site.config.json`. No se puede inventar un titular real; el README indica que hay que rellenarlos antes de
    pedir la revisión de AdSense.
20. **Contacto por email (`mailto:`)**, sin formulario: un formulario necesita un servidor o un servicio externo.

## Publicación

21. **GitHub Actions con `actions/deploy-pages`**: el workflow ejecuta `node build.mjs`, sube `_site/` y lo publica.
    Se ejecuta al hacer push a `main` y manualmente. No hace falta rama `gh-pages`.
22. **URL base configurable** (`siteOrigin` + `basePath` en `site.config.json`, ver decisión 29) para canonical, sitemap y Open Graph. Todos los enlaces
    internos son relativos, así que funciona tanto en `usuario.github.io/repo/` como en un dominio propio.

## Añadidas durante el desarrollo

23. **Detección automática de idioma propia.** Transformers.js 4.3 no detecta el idioma (si no se indica, asume
    inglés), así que el worker genera un único token tras `<|startoftranscript|>` sobre los primeros 30 s y lo
    traduce a código de idioma. Si falla, usa el idioma de la página. Por defecto el selector muestra el idioma de
    la página (más preciso que la detección).
24. **Proveedores nombrados solo en la política de privacidad.** GitHub Pages, jsDelivr, Hugging Face y Google
    AdSense se nombran en privacidad porque el RGPD exige informar de quién recibe datos (IP); no se usan sus logos
    ni se mencionan en el resto de la web.
25. **Pruebas sin descargar modelos.** El entorno de desarrollo no tenía acceso a los CDN, así que la prueba
    end-to-end sustituye Transformers.js por un simulador y comprueba todo lo demás con audio real (decodificación,
    troceado, progreso, edición, exportación, cancelación, móvil, anuncios). Se comprobó aparte que la librería
    real carga en el worker y pide el modelo correcto. La transcripción con el modelo real debe verificarse una vez
    publicada (ver README).
26. **Móvil primero en la portada:** en pantallas pequeñas se ocultan las etiquetas de ventajas y el enlace a FAQ
    de la cabecera (sigue en el pie) para que la herramienta aparezca antes; el texto de la caja dice «Toca» en vez
    de «Arrastra».
27. **Anuncios automáticos compatibles:** si `adsEnabled` y el ID están puestos pero no hay bloques, se carga igual
    el script de AdSense para que funcionen los anuncios automáticos.
28. **Comprobaciones en el workflow:** `tests/check-site.mjs` (sin dependencias) se ejecuta antes de publicar y
    bloquea la publicación si hay enlaces rotos, títulos/descripciones fuera de rango o JSON-LD inválido.
29. **Publicación en subcarpeta (`https://xabiouteda-ui.github.io/Gamee/`).** La URL pública se divide en
    `siteOrigin` y `basePath` en `site.config.json` (también sobrescribibles con las variables `SITE_ORIGIN` y
    `BASE_PATH` de Actions). Solo las URLs absolutas (canonical, hreflang, sitemap, Open Graph, 404) la usan; el
    resto de rutas son relativas. `check-site.mjs` falla si hay rutas que empiezan por `/` en HTML, CSS o JS, o URLs
    del dominio sin la ruta base; la prueba e2e sirve la web bajo `basePath` y falla si se pide algo fuera de ella.
    El workflow ya no toma la URL de GitHub Pages automáticamente (la del repo `Gamee` sería `/Gamee/`): usa la
    configurada y avisa si no coinciden.
30. **`basePath` = `/Gamee/`**, igual que el nombre del repositorio (GitHub Pages distingue mayúsculas), en lugar
    de `/game/`, para que canonical, hreflang y sitemap coincidan con la URL real de GitHub Pages sin renombrar el
    repositorio.

## Sesión 2 (28/09/2026): nuevas herramientas

31. **La PR #1 ya estaba fusionada**, así que la rama `claude/charming-edison-uxkvjw` se ha reiniciado desde `main`
    y el trabajo nuevo va en una PR nueva (la única de esta sesión).
32. **Herramientas elegidas** (ver `RESEARCH-2.md`): subtítulos karaoke grabados en el vídeo (4,55) y analizador de
    consumo eléctrico con comparador de tarifas a partir del CSV (4,05). Se descarta "limpiar la voz" porque con
    modelos autocontenidos (RNNoise) el resultado sería peor que alternativas gratis existentes, y DeepFilterNet
    solo está empaquetado con el modelo en el CDN de un tercero.
33. **Subtítulos animados: arquitectura.** Mismo worker de Whisper que Transcribe Libre (nuevo modo por palabra con
    `onnx-community/whisper-base_timestamped`, el único multilingüe con marcas por palabra confirmado). Si el modelo
    no devuelve tiempos por palabra, el worker vuelve al modo por frases y la página reparte el tiempo entre las
    palabras según su longitud (y lo avisa). El vídeo se crea con **Mediabunny 1.60 (MPL-2.0)** desde jsDelivr:
    descodifica, dibujamos cada fotograma + subtítulos en un canvas y lo vuelve a codificar con WebCodecs.
34. **Formato de salida:** MP4 con el primer códec que el navegador pueda codificar (H.264 → HEVC → VP9 → AV1) y,
    si ninguno, WebM. En Chrome normal sale H.264; en el Chromium de las pruebas sale VP9+Opus dentro de MP4 (probado).
    Vídeos de más de 1920 px se reducen a 1080p para exportar rápido. La rotación se aplica a los fotogramas.
35. **Fuentes propias (OFL) servidas desde el sitio** (Montserrat 900, Anton, Bangers, ~60 KB): así el vídeo final
    se ve igual en todos los dispositivos y no dependemos de Google Fonts (sin terceros extra en privacidad).
36. **Nombres de plataformas en el contenido.** Se nombran de forma descriptiva (Reels, TikTok, Shorts) porque es
    lo que la gente busca y tú lo pediste en la fase 4; sin logos ni aspecto de afiliación, con aviso en el aviso
    legal y en la página de plataformas. Sustituye a la decisión 3 para el texto (no para logos).
37. **SRT importado:** sus líneas se respetan tal cual (no se reparten en grupos de N palabras) hasta que el usuario
    mueve el control «Palabras por línea». En la página «incrustar» el estilo por defecto es «Clásico».
38. **En móvil también se usa por defecto el modo palabra a palabra** (≈80 MB): el efecto karaoke es el valor
    principal y los vídeos cortos se procesan rápido; el usuario puede elegir «Rápida».
39. **Pruebas nuevas:** `tests/unit-captions.mjs` (Node, sin dependencias, también en el workflow) y
    `tests/e2e-captions.cjs`, que genera un vídeo real en Chromium, simula solo el reconocimiento de voz, exporta
    con Mediabunny real y comprueba en los fotogramas del MP4 resultante que los subtítulos están grabados.
40. **Tarifa de luz: solo en español.** La tarifa 2.0TD, los ficheros de las distribuidoras y los impuestos son de
    España; una versión inglesa apenas tendría búsquedas. Queda en la lista de mejoras (público extranjero en España).
41. **Periodos 2.0TD sin tabla anual de festivos:** solo cuentan como valle los festivos nacionales de fecha fija
    (Circular 3/2020 CNMC), así que la regla no caduca. Impuestos (impuesto eléctrico 5,11 %, IVA 21 %, alquiler de
    contador típico) en `assets/js/luz/core.js` → `RULES`, con fecha de revisión visible en la página.
42. **Precios de las ofertas los pone el usuario** (sin IVA), con dos ofertas de ejemplo claramente marcadas. No se
    usan precios de ninguna compañía (ni marcas) ni el PVPC horario en la v1: exigiría datos externos que cambian a
    diario. Las ofertas y la potencia se guardan en `localStorage` para volver a comparar (uso recurrente).
43. **Lector de CSV tolerante:** detecta separador, columnas por nombre (fecha, hora, consumo; ignora
    «método de obtención»), fechas DD/MM/AAAA o AAAA-MM-DD, hora 1–24 o HH:MM (fin de intervalo), datos
    cuartohorarios (se suman por hora) y valores en Wh. El CUPS se muestra enmascarado.
44. **Potencia: consejo prudente.** El CSV horario solo da la media de cada hora, no el pico real; se muestra la
    hora de más consumo y cuánto ahorra cada kW, remitiendo al maxímetro de la distribuidora para decidir.
45. **Gráficos a mano en SVG/HTML** con la paleta categórica validada (3 series, modo claro y oscuro) y rampa
    secuencial azul para el mapa de calor; leyenda, tooltip y tabla de datos para accesibilidad.
