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
46. **Marca común «Herramientas Libres»** (descriptiva, sin parecido con marcas existentes, coherente con
    «Transcribe Libre», que se mantiene como nombre del transcriptor). `siteName` en `site.config.json`.
47. **La raíz `/` pasa a ser la portada que agrupa las herramientas**; el transcriptor se mueve a
    `/pasar-audio-a-texto/` (y `/en/audio-to-text/`). Las demás URLs existentes (FAQ, notas de voz, subtítulos SRT,
    legales) no cambian, así que no hay enlaces rotos; la raíz sigue existiendo. GitHub Pages no permite
    redirecciones 301, por eso se evitó mover más páginas.
48. **Menú:** herramientas en la cabecera (en móvil, fila desplazable debajo de la marca) y el idioma aparte; las
    FAQ y los legales, en el pie. Al final de cada herramienta, bloque automático «Más herramientas gratis».
49. **SEO de Transcribe Libre por casos de uso:** la página de notas de voz se reorienta a «audios de WhatsApp»
    (lo que la gente busca) con pasos para Android, iPhone y ordenador; nuevas páginas de clases, entrevistas y
    reuniones con contenido propio (flujo de trabajo, plantilla de acta, privacidad). «Subtítulos para TikTok» ya
    está cubierto por la guía de Reels/TikTok/Shorts de la herramienta de subtítulos. Solo en español (donde está
    la demanda); las versiones inglesas quedan en la lista de mejoras.
50. **Accesibilidad:** auditoría axe-core de las 26 páginas en claro y oscuro (incluida la vista de resultados de la
    luz) → 0 problemas; queda como prueba permanente (`tests/e2e-a11y.cjs`).
51. **Rendimiento:** cada página pesa ≤60 KB sin comprimir; las librerías pesadas (IA, vídeo) y las fuentes solo se
    cargan al usarlas. La imagen para redes pasa de PNG 281 KB a JPEG 33 KB.

## Sesión 3 (28/09/2026): luz en 1 clic, subtítulos y SEO

52. **PVPC descargado en el build, no desde el navegador.** La API de REE (apidatos.ree.es) es pública y sin
    token, pero no se pudo comprobar su CORS desde este entorno (red bloqueada). Descargarla en GitHub Actions
    funciona siempre: `scripts/fetch-pvpc.mjs` baja 13 meses de precios horarios (mes a mes, 3 reintentos) y los
    guarda en `data/pvpc.json` (no se versiona). El workflow se ejecuta también cada día a las 19:35 UTC, después de
    que REE publique los precios de mañana. Si REE falla, se reutiliza el JSON ya publicado; si tampoco hay, la web
    funciona sin PVPC y lo avisa. Solo se ejecuta a diario cuando el workflow está en `main` (tras fusionar).
53. **PVPC calculado hora a hora** con el CSV (las horas sin precio se valoran con la media de su periodo); en el
    cálculo rápido, con la media del último año por periodo. Potencia del PVPC 2026: peajes y cargos (P1 27,704413
    y P2 0,725423 €/kW·año) + margen de comercialización 3,113 €/kW·año en P1, según resultados de búsqueda de
    varias fuentes (la web de REE/CNMC/BOE no era accesible desde aquí). Queda en `data/ofertas.json` → `pvpcPower`.
54. **Catálogo de tarifas (`data/ofertas.json`)**: 6 tarifas muy contratadas con precio y potencia **verificados en
    fuentes públicas el 28/09/2026** (cada una con su enlace oficial y de dónde salió el dato; si las fuentes no
    coincidían se anota). No llegué a 8–10: para Repsol, Plenitude, Som Energia y otras no encontré a la vez precio
    de energía y de potencia fiables, y la regla es no inventar datos. Nombres de comercializadoras como texto
    descriptivo, sin logos ni afiliación; se indica «compruébalo antes de contratar».
55. **Resultado principal**: tarjeta grande «Tu mejor opción» con coste anual y, si eliges tu tarifa actual (se
    recuerda), «Ahorras ~X € al año frente a …». Si no la eliges, se compara con la media. Enlace a la web oficial
    de la ganadora. Tus propias tarifas pasan a «Ajustes» (plegado) y los antiguos ejemplos se descartan.
56. **Cálculo rápido sin CSV**: kWh al mes + potencia + % en valle; el resto se reparte 47/53 entre punta y llano
    (reparto típico de un hogar, orientativo). Se ocultan los gráficos horarios porque no hay datos reales.
57. **Formatos reales de CSV** en `tests/fixtures/`: CNMC (i-DE), e-distribución (`AE_kWh;AS_KWh;…;REAL/ESTIMADO`,
    documentado en SFL/Nergiza) y la descarga de Datadis (comillas, fecha AAAA/MM/DD, hora HH:MM). Del formato de UFD
    no encontré documentación fiable: se asume el formato común de la CNMC.
58. **Subtítulos para creadores:** selector «Para: TikTok / Reels / Shorts / Otro» que coloca el texto y estrecha
    las líneas dentro de la zona segura (valores aproximados en `PLATFORMS`, con margen) y la sombrea en la vista
    previa (nunca en el vídeo). Vídeos horizontales → opción de recorte centrado a 9:16 (sin IA de seguimiento de
    cara: queda como mejora). Tres estilos nuevos (Marcador, Progresivo, Neón) → 8 en total.
59. **Palabras clave:** automáticas (una por línea como mucho: números y palabras largas que no sean vacías) y a mano
    escribiendo `*palabra*` en el editor; se pintan en un tercer color configurable. **Emojis automáticos**
    desactivados por defecto (pueden resultar cargantes): diccionario de raíces ES/EN → un emoji por línea.
60. **Menos pasos:** la generación empieza sola al elegir el vídeo (salvo en «incrustar SRT»), y el botón de
    descarga está justo debajo de la vista previa. De subir a descargar: 2 clics.
61. **Exportación más rápida y honesta:** vídeos de más de 30 fps se exportan a 30 fps; progreso con tiempo
    restante; botón Cancelar; aviso si el navegador no pudo conservar el audio.
62. **Safari/iPhone:** no se ha podido probar en un Safari real. Se detecta la falta de `VideoEncoder` (iOS < 16.4,
    navegadores antiguos) y se avisa con alternativa (descargar el SRT); probado simulándolo en Chromium.
63. **«Precio de la luz hoy»** (la búsqueda diaria de más volumen del tema): se genera en el build un resumen
    estático de hoy y mañana (para buscadores y sin JavaScript) y en el navegador se pinta con los datos más
    recientes (gráfico de 24 horas, 3 horas más baratas, mejor franja de 3 h, tabla). Hora de España con
    `Intl` (Europe/Madrid) sea cual sea la zona del visitante. Se avisa de que solo afecta a PVPC/indexadas.
64. **Calculadora de electrodomésticos**: potencias y horas típicas marcadas como orientativas (en nevera y termo
    se usa una potencia media real); precio por defecto = media real del PVPC del último año si hay datos.
65. **«PVPC o mercado libre»**: tabla de diferencias + medias reales del PVPC del último año escritas en el build
    + el comparador incrustado. La página «descargar CSV por distribuidora» no se ha dividido en una por
    distribuidora: no hay pasos verificables de cada web; se documentan los formatos reales en la guía existente.
66. **Páginas de subtítulos por búsqueda:** TikTok, Reels y Shorts (cada una con la plataforma y su zona segura ya
    elegidas y consejos propios de esa app: botones laterales en TikTok, recorte de la miniatura en Reels, pasar de
    vídeo largo horizontal a Short), «subtítulos en inglés para un vídeo en español» (nueva opción de traducir el
    audio al inglés con Whisper) y «videopodcasts y entrevistas» (estilo clásico preseleccionado). No se crea una
    página aparte para «subtítulos automáticos gratis sin marca de agua»: es la búsqueda principal de la portada
    de la herramienta y otra página competiría con ella.

## Sesión 4 (28/09/2026): monetización más allá de AdSense

67. **Afiliados en `data/afiliados.json`, desactivados dos veces** (interruptor general `enabled` y uno por enlace,
    con `url` vacía). Sin URL `https://` válida no se pinta nada. Solo salen en la pantalla de resultado: tras
    exportar el vídeo (subtítulos) y al terminar de transcribir; nunca antes de usar la herramienta. Texto propio en
    español e inglés, etiqueta «Enlace de afiliado», `rel="sponsored nofollow noopener"` y enlace a «Cómo ganamos
    dinero». El nombre del proveedor va como texto entre paréntesis, sin logos. No se escriben comisiones en ningún
    sitio (no son públicas de forma fiable y el plan pide no inventarlas).
68. **Página «Cómo ganamos dinero»** (es + en) enlazada en el pie de todas las páginas: publicidad, afiliados,
    comparador de luz ordenado por precio con patrocinados marcados, Pro opcional y crédito «Hecho con». Dice
    expresamente que el comparador no es oficial y enlaza el de la CNMC (Directiva Ómnibus / LSSI).
69. **Luz, patrocinados sin tocar el orden:** la lista ya se ordenaba por coste anual; se deja fijo y hay prueba.
    Una tarifa solo cuenta como patrocinada si `sponsoredEnabled: true` (desactivado) y la tarifa tiene
    `sponsored: true` + `affiliateUrl` https. Entonces lleva la etiqueta «Patrocinado», su enlace pasa a
    `rel="sponsored nofollow"` y aparece también en un hueco «Ofertas patrocinadas» con su **puesto real por
    precio**. Nunca sube de puesto. Nota bajo la lista explicándolo y enlace a «Cómo ganamos dinero».
70. **Placas solares (orientativo, sin datos personales):** solo con consumo horario (CSV o ejemplo; en el cálculo
    rápido no hay horas y no se muestra). Producción = kWp × producción anual de la zona (norte 1.150, centro
    1.350, sur 1.550 kWh/kWp, a partir de PVGIS) repartida por meses y en una curva de sol por horas (mediodía
    solar 13:15/14:15 según horario). Autoconsumo hora a hora = mín(producción, consumo), valorado al precio de
    energía de la tarifa actual elegida (o la mejor) + impuesto eléctrico e IVA; excedentes a 0,06 €/kWh con el
    tope mensual de la compensación simplificada. Coste 1.300 €/kWp (rango publicado 850–1.600). Todo en
    `data/ofertas.json` → `solar`, con fuentes. Tamaño recomendado: el mayor cuyo retorno no empeora más de 1 año
    respecto al mejor. No se piden teléfonos (riesgo AEPD del plan): solo se sugiere pedir presupuestos.
71. **Crédito «Hecho con Herramientas Libres»** en los vídeos exportados: píldora semitransparente con el logotipo
    de barras de la web, arriba a la izquierda (dentro de la zona segura si se eligió TikTok/Reels/Shorts), ≈2,4 %
    del lado corto. Activado por defecto, se ve en la vista previa y **se quita siempre con una casilla, también
    en la versión gratis** (el plan decía a la vez «Pro quita el crédito» y «se puede quitar siempre»; gana lo
    segundo porque la promesa de la herramienta es «sin marca de agua»). La elección se recuerda. Con dominio
    propio el crédito añade el dominio (`… · tudominio.es`); con la dirección larga de github.io, no.
72. **Pro de pago único sin servidor**: licencia `HL1.<datos>.<firma>` firmada con ECDSA P-256 y comprobada en el
    navegador con Web Crypto y la clave pública de `data/pro.json`. La privada la crea el titular con
    `node scripts/pro-keys.mjs init` (queda en `pro-private-key.json`, en `.gitignore`) y emite claves con
    `issue`. La clave no lleva nombre ni correo. Sin servidor no se puede emitir la clave automáticamente al pagar:
    al principio se envía a mano (o con la función de «license keys» de la pasarela si se usa). Se asume que alguien
    experto podría saltarse la comprobación en el navegador; no merece la pena montar servidores por eso.
    **Desactivado por defecto** (`enabled: false`, sin clave pública, sin enlace de pago y sin precio: el precio lo
    decide el titular, no se inventa). Con Pro desactivado no se ve nada de Pro en las herramientas y `/pro.html`
    queda `noindex` y fuera del sitemap. Si está a la venta pero no tienes clave, las funciones se ven bloqueadas
    con enlace a `/pro.html`.
73. **Qué desbloquea Pro:** fuentes propias (se guardan en el navegador si pesan <1,5 MB), kit de marca guardado que
    se aplica solo, 2 estilos extra («Titular» y «Suave»), exportación hasta 4K (gratis sigue en 1080p), varios
    vídeos seguidos con el mismo estilo y exportar la transcripción a Word (.docx generado sin librerías, ZIP
    «store» propio, validado con python-docx). El crédito «Hecho con» empieza quitado con Pro. **No se limita la
    duración de los vídeos gratis** («vídeos largos» del plan): la herramienta promete «sin límite» en muchas
    páginas y quitarlo empeoraría el producto gratis; se puede revisar con datos.
74. **Pagos:** enlace de pago de Paddle o Stripe (Managed Payments) en `checkoutUrl`: son «merchant of record» y
    se ocupan del IVA de la UE. La web no toca datos de tarjeta. Privacidad actualizada (es y en).
75. **Telegram a las 20:40 de Madrid:** los `cron` de GitHub van en UTC y no entienden el horario de verano, así
    que hay dos (18:40 y 19:40 UTC) y un primer paso que compara `github.event.schedule` con el desfase real de
    Madrid para publicar solo una vez (aunque GitHub retrase el cron). El script pide a REE solo el día de mañana
    (a esa hora `data/pvpc.json` de la web aún no está actualizado: el despliegue diario es a las 19:35 UTC) y
    reintenta 4 veces cada 5 min si aún no están. Sin secretos, sin precios o si Telegram rechaza el mensaje:
    aviso en el registro y termina en verde. El token nunca se imprime. Probado con un servidor local que simula
    REE y Telegram (`tests/unit-monetizacion.mjs`); no se ha probado con un bot real.
76. **Widget con iframe** (no un script que se ejecute en la web ajena): más seguro para quien lo inserta y no
    puede romper su página. Página `/widget/luz-hoy.html` «desnuda» (sin menú ni anuncios, `noindex`, fuera del
    sitemap) con CSS propio de 2 KB y un JSON de 4 días (`data/pvpc-hoy.json`) en vez de los ~400 días; si no
    existe, usa `pvpc.json`. El enlace de atribución va **fuera** del iframe en el código para copiar (dentro de un
    iframe no cuenta para buscadores) y también dentro del widget. Tema claro/oscuro/automático. Sin cookies.

## Sesión 5 (29/09/2026): dominio propio, SEO y marketing

77. **Dominio `https://herramientaslibres.es` con `basePath` "/"** en `site.config.json` (y las variables de
    Actions). El último despliegue manual (28/09) falló porque `check-site` comparaba la portada con el antiguo
    `github.io/Gamee/`; al cambiar el archivo, vuelve a pasar. El aviso del workflow saltaba porque GitHub Pages
    devuelve `http://herramientaslibres.es` (HTTPS aún no obligatorio): ahora compara sin el esquema y, si solo
    falta HTTPS, deja una nota en vez de un aviso. Sin archivo `CNAME`: con despliegue por Actions GitHub lo ignora
    y el dominio se guarda en Settings → Pages.
78. **`ads.txt` siempre en la raíz.** Sin ID de AdSense lleva solo un comentario (válido según la especificación de
    IAB); con ID, la línea de Google. `check-site` comprueba que existe, que `robots.txt` apunta al sitemap del
    dominio y que no queda ninguna URL de `github.io` en la web.
79. **Marca única «Herramientas Libres».** 7 páginas del transcriptor seguían con el nombre antiguo «Transcribe
    Libre» en el título: dividía la marca y no la busca nadie. Títulos ≤ 65 caracteres (Google corta hacia 60).
80. **Enlazado interno automático:** cada página cuelga de una sección (luz, subtítulos, audio a texto) según su
    carpeta. Llevan migas de pan visibles + `BreadcrumbList`, y un bloque «Guías relacionadas» con todas las demás
    páginas de la sección (nombre corto en `"nav"` de la cabecera JSON). Así una página nueva queda enlazada desde
    todas sus hermanas sin tocar las demás.
81. **`lastmod` real** = fecha del último commit del archivo de la página (el workflow hace checkout completo);
    las páginas con `"daily": true` (precios del día) usan la fecha de `data/pvpc.json` si es posterior.
82. **IndexNow**: clave pública (no es secreta) en `site.config.json` → `/<clave>.txt`. `scripts/indexnow.mjs` lee el
    sitemap ya publicado y avisa: todas las URL tras un push, solo las de lastmod de hoy en el despliegue diario.
    Nunca rompe el workflow. Google no usa IndexNow: para Google basta el sitemap en Search Console.
83. **Imágenes OG por página** generadas con Chromium (`scripts/og-images.mjs`) y guardadas en el repo (~75 KB
    cada una). No se generan en el build para no meter un navegador en Actions; `check-site` falla si una página
    indexable no tiene la suya, así que no se olvida.
84. **`Dataset` de schema.org** para el PVPC con `isBasedOn` REE y descarga `data/pvpc.json`. No se declara
    licencia: REE no la indica como tal en la API; se cita siempre la fuente.
85. **Pruebas e2e de la luz sin depender de que exista `data/pvpc.json` en local**: simulan el fallo de REE con
    una ruta 404. Antes fallaban si alguien descargaba los precios reales antes de probar.
