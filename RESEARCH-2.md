# Investigación 2: herramientas nuevas que destaquen

Fecha: 28/09/2026. Objetivo: 1–2 herramientas **nuevas** para este sitio que (1) sustituyan algo de pago o escondido
tras un muro de pago o marca de agua, (2) no tengan buenas alternativas gratis, (3) funcionen 100 % en el navegador
con licencias que permitan uso comercial, y (4) monetizen bien con AdSense.

Descartado de entrada (por indicación): unir/comprimir PDF, QR, transcripción simple, conversores de formato,
sueldo neto, finiquito, CV, descargadores y facturas.

## Método

- Búsqueda en Google (desde un buscador con resultados de EE. UU., en español) de las palabras clave principales de
  cada idea, revisando **quién sale en los primeros resultados y qué ofrece gratis de verdad**.
- La **demanda es una estimación** (no hay acceso a Keyword Planner ni a Semrush en esta sesión). Se deduce del
  número y el tipo de competidores que invierten en posicionar, de la cobertura en medios y de la existencia de
  herramientas oficiales. Escala: **A** muy alta · **B** alta · **C** media · **D** baja. Hay que validarla con
  Google Trends / Keyword Planner antes de invertir más.
- Criterios y pesos:

| Criterio | Peso | 5 significa… |
|---|---|---|
| Demanda (es + en) | 20 % | Muchas búsquedas, varias variantes long tail |
| Hueco competitivo | 25 % | Lo gratis que hay es malo, limitado, con marca de agua o sube tus archivos |
| Valor de anuncio (CPC del tema) | 15 % | Temas caros: energía, vivienda, finanzas, software |
| Recurrencia | 10 % | La gente vuelve (semanal/mensual) |
| Viable en navegador + licencias | 15 % | Sin servidor, dependencias MIT/Apache/MPL, sin datos externos frágiles |
| Diferenciación "IA local" | 5 % | Algo que hace 2 años no se podía hacer en el navegador |
| Riesgo de mantenimiento (inverso) | 10 % | 5 = no depende de normativa o datos que cambian |

## Ideas evaluadas (17)

### 1. Subtítulos animados tipo karaoke grabados en el vídeo (Shorts, Reels, TikTok)
- **Lo que cobran otros:** Submagic gratis = 3 vídeos al mes de ≤1:30 **con marca de agua**; quitarla cuesta 19 $/mes
  ([fluxnote](https://fluxnote.io/guides/submagic-free-plan-limits-2026), [itechguides](https://www.itechguides.com/best/ai-video-caption-generators/submagic/)).
  En CapCut los subtítulos automáticos han pasado a **Pro** en muchos casos (hay decenas de vídeos quejándose:
  [1](https://www.tiktok.com/discover/capcut-ahora-tiene-subtitulos-automaticos-en-pro),
  [2](https://www.tiktok.com/discover/los-subt%C3%ADtulos-en-capcut-ahora-son-pro)); Pro ≈10 $/mes. VEED y Kapwing
  ponen marca de agua o limitan minutos.
- **Primeros resultados en Google:** artículos de marketing de las propias apps de pago ("5 generadores sin marca
  de agua" publicado por una de ellas), apps móviles, y webs de IA con registro obligatorio y créditos
  ([resultados](https://www.capcut.com/es-es/resource/free-subtitle-generator-no-watermark), [short.ai](https://www.short.ai/es/ai-caption-generator/auto-subtitle-generator), [clipa](https://clipa.app/en)).
  **Ninguna** es gratis de verdad, sin registro, sin límite y sin subir el vídeo.
- **Demanda:** A (estimación): "subtítulos para tiktok", "subtítulos animados", "poner subtítulos a un vídeo",
  "subtítulos automáticos para reels", "subtítulos estilo…" + inglés "animated captions", "karaoke captions".
- **En el navegador:** sí. Whisper (MIT) con Transformers.js (Apache-2.0) ya está en este sitio; hay modelos con
  marcas de tiempo por palabra (`onnx-community/whisper-*_timestamped`); **Mediabunny (MPL-2.0)** descodifica,
  permite dibujar sobre cada fotograma con canvas y vuelve a codificar a MP4 con WebCodecs (hay incluso un
  [tutorial](https://www.ai-engineer.io/tutorials/build-karaoke-style-captions-for-video) de este caso). Hace 2 años
  WebCodecs no estaba en Safari/Firefox y Whisper en WebGPU no existía.
- **Anuncios:** CPC medio (software/creadores). **Recurrencia alta:** los creadores publican cada semana.
- **Sinergia:** reutiliza el motor de Transcribe Libre y comparte tráfico (enlaces cruzados).

### 2. "¿Qué tarifa de luz me conviene?" con tu consumo real (CSV de la distribuidora)
- **Problema:** en España cualquiera puede descargar de su distribuidora/Datadis un CSV con su consumo **hora a
  hora** (formato CNMC `CUPS;Fecha;Hora;Consumo_kWh;Metodo_obtencion`,
  [fuente](https://www.simuladorfacturaluz.es/el-fichero-csv-de-consumos/)). Con él se puede saber qué tarifa sale
  más barata, cuánto consume cada periodo (punta/llano/valle) y si sobra potencia contratada (lo habitual,
  [ICAEN](https://icaen.gencat.cat/es/energia/auditories-energetiques/eina-doptimitzacio-de-la-potencia-contractada/index.html)).
- **Primeros resultados:** comparadores de las propias comercializadoras o de intermediarios que cobran comisión y
  piden tus datos; simuladores antiguos, poco usables en móvil
  ([SFL](https://www.simuladorfacturaluz.es/analizador-fichero-csv-consumos/),
  [Fusión Ingeniería](https://fusioningenieria.com/precio-luz-hoy/factura-de-la-luz/simulador-factura-luz/));
  herramientas que piden tus credenciales de Datadis ([MiVertido](https://mivertido.es/)); y el comparador de la
  CNMC, que **no lee el CSV** (hay que meter los kWh a mano). Hay hueco para una herramienta moderna, privada (el CSV
  lleva tu CUPS y no sale del navegador), visual y que compare **tus** ofertas reales.
- **Demanda:** A/B (estimación): "qué tarifa de luz me conviene", "comparador tarifas luz", "potencia contratada
  cuál necesito", "bajar potencia contratada", "tarifa 3 periodos o precio fijo", "datadis csv".
- **Anuncios:** **CPC muy alto** (energía: las comercializadoras y comparadores pagan mucho por clic).
- **Recurrencia:** media-alta (cada cambio de oferta, cada verano/invierno, al renovar contrato).
- **En el navegador:** sí, JS puro. Riesgo: la estructura de la tarifa 2.0TD (periodos, festivos) puede cambiar y
  los impuestos también → se aísla en un único archivo de datos con fecha de revisión, y los precios los mete el
  usuario (los de su oferta) o se ofrecen valores de ejemplo editables.

### 3. Limpiar la voz / quitar ruido de un audio
- Competencia: ElevenLabs Voice Isolator, Adobe Enhance, VEED, LALAL, StemSplit (5 min gratis con registro),
  VidClean (10 min) ([resultados](https://elevenlabs.io/es/voice-isolator), [stemsplit](https://stemsplit.io/es/voice-cleaner)).
  Hay versiones gratis decentes (aunque limitadas).
- En navegador: RNNoise (BSD/Apache, autocontenido) o DeepFilterNet3 (MIT/Apache) — este último solo empaquetado
  con el modelo en el CDN de un tercero. RNNoise es claramente peor que los líderes → no destaca.
- Demanda B · CPC medio · recurrencia media.

### 4. Anonimizar/tachar documentos (nóminas, contratos, DNI) con detección automática
- Competencia: Smallpdf, Xodo, i2pdf, Certyneo, redactpdf.io, redact-pdf.ai… muchas gratis
  ([resultados](https://smallpdf.com/es/redactar-pdf), [xodo](https://xodo.com/redact-pdf)). Hueco: detección
  automática de DNI/NIE/IBAN españoles sin subir el PDF.
- Demanda C · CPC medio-alto (vivienda si se enfoca a "nómina para alquilar") · recurrencia baja.

### 5. Marca de agua para el DNI
- Ya saturado: varias herramientas gratuitas en el navegador y cobertura en medios
  ([Xataka](https://www.xataka.com/aplicaciones/enviar-dni-a-desconocido-peligroso-esta-nueva-app-tiene-solucion-gratis-ponerle-marca-agua),
  [pantallazo](https://www.pantallazo.es/herramientas/marca-de-agua-dni), [protegedni](https://protegedni.es/)).

### 6. Calculadora de plusvalía municipal
- Saturado: al menos 9 calculadoras gratuitas en la primera página, con método real vs objetivo
  ([resultados](https://calculadoraplusvalia.es/), [guiafiscal](https://guiafiscal.es/calculadoras/plusvalia-municipal/)).
  Además depende de coeficientes que cambian cada año.

### 7. Actualización del alquiler (IRAV/IPC)
- Saturado + hay calculadora oficial del ministerio; depende de un índice mensual del INE
  ([resultados](https://irav.es/), [calcularindemnizacion](https://calcularindemnizacion.es/calculadoras/actualizacion-rentas)).

### 8. Analizador de extractos bancarios y detector de suscripciones olvidadas
- Hueco: las apps de finanzas conectan con tu banco (privacidad) o son de pago. CPC finanzas alto, recurrencia
  mensual. Pero cada banco exporta un Excel distinto → parser frágil; mucho trabajo para que sea "mejor".

### 9. Difuminar caras y matrículas en fotos y vídeos
- MediaPipe (Apache-2.0) detecta caras; matrículas es más difícil. Competencia media. CPC bajo.

### 10. Fotos de carnet/pasaporte con tamaño oficial
- Competencia alta (varias webs gratis); el recorte de fondo tiene problemas de licencia de modelos.

### 11. Separar voz y música (quitar la voz de una canción)
- Saturado con alternativas gratis buenas; modelos pesados.

### 12. Simulador de amortización anticipada de hipoteca
- CPC altísimo, pero saturado por bancos y portales con buenos simuladores.

### 13. Teleprompter que sigue tu voz
- Función de pago en apps; en navegador sin servidor necesitaría Whisper en tiempo real (viable con WebGPU, justo).
  Demanda C, CPC bajo.

### 14. Borrar objetos o personas de fotos
- LaMa (Apache-2.0) en ONNX ≈200 MB; lento en móvil; competencia gratis decente.

### 15. Pasar vídeo horizontal a vertical 9:16 siguiendo la cara (auto-reframe)
- Función de pago en herramientas de clips. Viable (MediaPipe + Mediabunny). Demanda C. **Buena función
  futura dentro de la idea 1.**

### 16. Rentabilidad de un piso para alquilar (inversor)
- CPC alto; muchas calculadoras de portales; poca diferenciación posible.

### 17. Coste real coche eléctrico vs gasolina con tu recorrido
- Muchas calculadoras de marcas y medios; datos de precios volátiles.

## Puntuación

| # | Idea | Demanda 20 % | Hueco 25 % | CPC 15 % | Recurr. 10 % | Viable 15 % | IA local 5 % | Mant. 10 % | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Subtítulos karaoke grabados en el vídeo** | 5 | 5 | 3 | 5 | 4 | 5 | 5 | **4,55** |
| 2 | **Tarifa de luz con tu CSV de consumo** | 4 | 4 | 5 | 4 | 5 | 1 | 3 | **4,05** |
| 15 | Vídeo horizontal a vertical automático | 3 | 4 | 3 | 4 | 3 | 5 | 5 | 3,65 |
| 4 | Anonimizar documentos | 3 | 3 | 4 | 2 | 4 | 3 | 5 | 3,40 |
| 8 | Extractos bancarios y suscripciones | 3 | 4 | 5 | 4 | 2 | 1 | 3 | 3,40 |
| 3 | Limpiar la voz | 4 | 2 | 3 | 3 | 3 | 4 | 5 | 3,20 |
| 12 | Amortización anticipada hipoteca | 4 | 1 | 5 | 2 | 5 | 1 | 4 | 3,20 |
| 13 | Teleprompter que sigue la voz | 3 | 3 | 2 | 3 | 3 | 5 | 5 | 3,15 |
| 9 | Difuminar caras/matrículas | 3 | 3 | 2 | 2 | 4 | 4 | 5 | 3,15 |
| 5 | Marca de agua DNI | 4 | 1 | 3 | 2 | 5 | 1 | 5 | 3,00 |
| 16 | Rentabilidad alquiler | 3 | 1 | 5 | 2 | 5 | 1 | 4 | 3,00 |
| 14 | Borrar objetos de fotos | 4 | 2 | 2 | 2 | 2 | 4 | 5 | 2,80 |
| 6 | Plusvalía municipal | 4 | 1 | 5 | 1 | 5 | 1 | 1 | 2,80 |
| 7 | Actualización alquiler IRAV | 4 | 1 | 4 | 3 | 4 | 1 | 1 | 2,70 |
| 11 | Separar voz y música | 4 | 1 | 2 | 2 | 2 | 3 | 5 | 2,50 |
| 10 | Fotos de carnet | 4 | 1 | 2 | 1 | 3 | 3 | 4 | 2,45 |
| 17 | Coche eléctrico vs gasolina | 3 | 1 | 4 | 1 | 4 | 1 | 2 | 2,40 |

(Ejemplo, nº 1: 5·0,20 + 5·0,25 + 3·0,15 + 5·0,10 + 4·0,15 + 5·0,05 + 5·0,10 = 4,55.)

## Elegidas

### 1ª — Subtítulos animados tipo karaoke para vídeos cortos (4,55)
- **Por qué:** la competencia cobra justo por lo que queremos dar gratis (quitar la marca de agua, más de 3 vídeos,
  vídeos de más de 1:30). La única forma de ofrecerlo gratis e ilimitado es la nuestra: procesar en el dispositivo.
  Público joven y muy recurrente (publican cada semana) y enorme volumen de búsqueda. Reutiliza el motor de
  transcripción que ya tenemos, así que el riesgo técnico es menor.
- **Mejor que lo gratis:** sin marca de agua, sin registro, sin límite de vídeos ni duración, el vídeo no se sube,
  estilos listos para redes (palabra resaltada, "pop", caja), edición del texto antes de grabar, vista previa en
  directo y exportación MP4 lista para subir, además de SRT/ASS.
- **Riesgos:** exportar vídeo en móviles antiguos (WebCodecs) → comprobación previa con mensaje claro; marcas de
  tiempo por palabra de Whisper en navegador con problemas conocidos
  ([issue](https://github.com/huggingface/transformers.js/issues/1358)) → se reparten por sílabas dentro de cada
  segmento si fallan, y se pueden ajustar a mano.

### 2ª — Analizador de consumo eléctrico y comparador de tarifas con tu CSV (4,05)
- **Por qué:** es el tema con los anuncios más caros de todos los evaluados (energía), es un problema 100 %
  español (tarifa 2.0TD, periodos, potencia, Datadis) y la gente vuelve cada vez que le ofrecen otra tarifa. Lo que
  hay gratis es viejo, pide tus datos o te hace meter los kWh a mano.
- **Mejor que lo gratis:** arrastras el CSV y en un segundo ves tu consumo por periodos, mapa de calor por horas,
  días de más consumo, cuánto pagarías con cada oferta (las tuyas, editables), cuánto ahorrarías moviendo consumo al
  valle y si puedes bajar la potencia. Todo en el navegador (el CSV lleva tu CUPS).
- **Riesgos:** cambios de normativa (festivos, periodos, impuestos) → datos en un archivo con fecha de revisión y
  aviso visible; el precio exacto del PVPC necesita precios horarios externos → en la v1 se compara con ofertas de
  precio fijo o por periodos que introduce el usuario y se deja el PVPC como mejora (lista de PROGRESS.md).

## Fuentes

- Submagic: [fluxnote](https://fluxnote.io/guides/submagic-free-plan-limits-2026) · [itechguides](https://www.itechguides.com/best/ai-video-caption-generators/submagic/) · [cutsnap](https://cutsnap.ai/blog/submagic-pricing-2026)
- CapCut subtítulos Pro: [TikTok 1](https://www.tiktok.com/discover/capcut-ahora-tiene-subtitulos-automaticos-en-pro) · [TikTok 2](https://www.tiktok.com/discover/los-subt%C3%ADtulos-en-capcut-ahora-son-pro) · [automatizayescala](https://automatizayescala.com/herramientas/ia-video/capcut/)
- Subtítulos gratis: [capcut resource](https://www.capcut.com/es-es/resource/free-subtitle-generator-no-watermark) · [short.ai](https://www.short.ai/es/ai-caption-generator/auto-subtitle-generator) · [clipa](https://clipa.app/en) · [tutorial karaoke en el navegador](https://www.ai-engineer.io/tutorials/build-karaoke-style-captions-for-video)
- Whisper con marcas por palabra: [modelo](https://huggingface.co/onnx-community/whisper-base_timestamped) · [issue 1358](https://github.com/huggingface/transformers.js/issues/1358)
- Luz: [SFL analizador CSV](https://www.simuladorfacturaluz.es/analizador-fichero-csv-consumos/) · [formato CSV](https://www.simuladorfacturaluz.es/el-fichero-csv-de-consumos/) · [Fusión Ingeniería](https://fusioningenieria.com/precio-luz-hoy/factura-de-la-luz/simulador-factura-luz/) · [MiVertido](https://mivertido.es/) · [LuzFija](https://luzfija.es/) · [ICAEN potencia](https://icaen.gencat.cat/es/energia/auditories-energetiques/eina-doptimitzacio-de-la-potencia-contractada/index.html) · [OCU Datadis](https://www.ocu.org/vivienda-y-energia/gas-luz/noticias/datos-suministro-electrico)
- Voz: [ElevenLabs](https://elevenlabs.io/es/voice-isolator) · [StemSplit](https://stemsplit.io/es/voice-cleaner) · [VidClean](https://vidclean.net/enhance-speech) · [DeepFilterNet en navegador](https://github.com/boredland/noise)
- Documentos: [Smallpdf](https://smallpdf.com/es/redactar-pdf) · [Xodo](https://xodo.com/redact-pdf) · [Certyneo](https://certyneo.com/es/herramientas/caviarder-pdf)
- DNI: [Xataka](https://www.xataka.com/aplicaciones/enviar-dni-a-desconocido-peligroso-esta-nueva-app-tiene-solucion-gratis-ponerle-marca-agua) · [pantallazo](https://www.pantallazo.es/herramientas/marca-de-agua-dni) · [protegedni](https://protegedni.es/)
- Plusvalía: [calculadoraplusvalia](https://calculadoraplusvalia.es/) · [guiafiscal](https://guiafiscal.es/calculadoras/plusvalia-municipal/)
- IRAV: [irav.es](https://irav.es/) · [calcularindemnizacion](https://calcularindemnizacion.es/calculadoras/actualizacion-rentas)
