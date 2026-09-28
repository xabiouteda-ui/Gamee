# Investigación: herramientas de pago que se pueden hacer gratis en el navegador

Fecha: septiembre de 2026. Objetivo: encontrar una herramienta que hoy la gente **paga** (o que tiene límites
molestos en su versión gratuita), que se pueda hacer **100 % en el navegador** (sin servidor ni costes, alojada
en GitHub Pages) y monetizar con anuncios.

## Cómo se ha evaluado

| Criterio | Peso | Qué mide |
|---|---|---|
| Demanda (sobre todo en español) | 30 % | Volumen de búsqueda de las palabras clave principales en España + Latinoamérica |
| Competencia débil | 15 % | 5 = pocas alternativas buenas y gratis; 1 = mercado saturado por gigantes |
| Viable sin servidor | 15 % | 5 = todo cabe en el navegador sin problemas; 1 = necesita backend |
| Facilidad | 10 % | 5 = un fin de semana; 1 = proyecto de meses |
| Potencial con anuncios | 20 % | Tiempo en página, visitas recurrentes, RPM del nicho |
| "Sustituye algo de pago" | 10 % | Cuánto dinero/limitación le ahorra al usuario (argumento de marketing) |

Puntuación final = suma ponderada sobre 5 (máximo 5,00).

**Sobre los datos de demanda:** en esta sesión no hay acceso a herramientas de palabras clave (Semrush, Ahrefs,
Keyword Planner), así que los volúmenes son **estimaciones de orden de magnitud** (búsquedas/mes en todo el mundo
hispanohablante) basadas en lo que se puede observar públicamente: número y tipo de competidores que pujan y
posicionan, existencia de artículos comparativos en medios grandes (p. ej. Xataka tiene un artículo de "19
herramientas gratis para transcribir"), y conocimiento general del sector. Antes de invertir más, conviene
validarlos con Google Trends y Keyword Planner (gratis con una cuenta de Google Ads).

Escala usada: **A** = >500 k/mes · **B** = 100 k–500 k · **C** = 20 k–100 k · **D** = <20 k.

**Sobre el RPM de AdSense en español** ([sergiocanales.com](https://sergiocanales.com/cuanto-paga-google-adsense-por-1000-visitas/)):
España paga bastante más que Latinoamérica (≈2–12 € por 1000 visitas según nicho frente a ≈0,4–1,2 € en México y
menos en el resto). Conclusión: el tráfico en español paga poco por visita, así que **hace falta mucho volumen y
mucho tiempo en página** (más impresiones por visita). Una herramienta que hace esperar al usuario unos minutos
mirando la página (procesando) es ideal.

---

## Las ideas (19)

### 1. Transcribir audio y vídeo a texto (Whisper en el navegador)
- **De pago hoy:** Otter.ai (gratis: 300 min/mes, 30 min por conversación, solo 3 importaciones de archivo *en
  total*; Pro 16,99 $/mes), TurboScribe (gratis: 3 archivos/día de 30 min; 10 $/mes), Happy Scribe (de pago por
  minuto), Notta, etc. ([tldv](https://tldv.io/blog/otter-pricing/), [comparativa](https://convertaudiototext.com/blog/turboscribe-vs-otter)).
- **Palabras clave:** "pasar audio a texto", "transcribir audio a texto", "convertir audio a texto", "transcribir
  audio gratis", "transcribir nota de voz", "transcribir video a texto", "transcripción automática". Demanda **A**
  (el término aparece en muchísimas variantes; hay un artículo de Xataka dedicado solo a esto).
- **Competencia:** alta en número, pero **todas suben tu audio a un servidor** y ponen límites (minutos, archivos
  al día, registro obligatorio). Muy pocas funcionan en local, y casi ninguna en español.
- **¿Sin servidor?** Sí. Transformers.js + modelos Whisper en ONNX, con WebGPU cuando existe (3–5× más rápido) y
  WebAssembly como alternativa ([artículo](https://whisperstt.com/blog/transcribe-audio-in-browser/),
  [tutorial](https://dev.to/fzsheik/how-i-built-a-private-audio-transcription-tool-in-browser-using-transformersjs-1fl0)).
  El modelo (40–250 MB) se descarga una vez del CDN de Hugging Face (gratis) y queda en caché. Whisper es licencia
  MIT y Transformers.js Apache-2.0: **uso comercial permitido**.
- **Dificultad:** media (worker, decodificación de audio, troceado, exportar SRT/VTT).
- **Anuncios:** excelente. El usuario espera varios minutos con la página abierta → muchas impresiones por visita.
  Nicho "productividad/educación/periodismo" con RPM medio.
- **Argumento:** "Sin límites, sin registro y tu audio nunca sale de tu dispositivo". Privacidad = diferenciación
  real, no solo marketing.

### 2. Subtítulos automáticos (generar SRT/VTT de un vídeo)
- **De pago hoy:** VEED (gratis con marca de agua, 10 min; descargar SRT es Pro), Kapwing (4 min gratis por
  proyecto) ([fuente](https://dc.wondershare.es/auto-caption/online-subtitle-generator.html),
  [Kapwing](https://www.kapwing.com/subtitles)).
- **Palabras clave:** "generar subtítulos automáticos", "crear subtítulos srt", "subtítulos automáticos gratis".
  Demanda **C**.
- **Competencia:** media; CapCut (app) lo da gratis.
- **¿Sin servidor?** Sí, es la misma tecnología que la idea 1 (Whisper devuelve marcas de tiempo).
- **Dificultad:** media. **Anuncios:** buenos (mismo motivo que la 1).
- **Nota:** se puede integrar como función de la idea 1 → suma su demanda a la ganadora.

### 3. Quitar el fondo de una imagen
- **De pago hoy:** remove.bg (resolución completa y lotes por créditos), Cutout.pro (HD por créditos)
  ([remove.bg](https://www.remove.bg/es), [cutout.pro](https://www.cutout.pro/remove-background)).
- **Palabras clave:** "quitar fondo", "quitar fondo a una imagen", "eliminar fondo". Demanda **A**.
- **Competencia:** feroz y ya hay muchas alternativas gratis en HD (Photoroom, Pixelcut, erase.bg…).
- **¿Sin servidor?** Técnicamente sí, pero **problema de licencias**: RMBG-1.4 es no comercial y
  `@imgly/background-removal` es AGPL ([fuente](https://github.com/imgly/background-removal-js)). Habría que usar
  modelos MIT/Apache (BiRefNet, MODNet) que son más pesados o peores.
- **Dificultad:** media. **Anuncios:** medios (visita corta).

### 4. Comprimir PDF
- **De pago hoy:** Smallpdf (límite diario, compresión fuerte es Pro), iLovePDF (Premium)
  ([Smallpdf](https://smallpdf.com/es/comprimir-pdf), [iLovePDF](https://www.ilovepdf.com/es/comprimir_pdf)).
- **Demanda:** **A**. **Competencia:** saturada (iLovePDF, Smallpdf, PDF24, Adobe, Canva… todas gratis de sobra).
- **¿Sin servidor?** Parcial: pdf-lib no recomprime imágenes; haría falta Ghostscript/qpdf en WASM (Ghostscript
  es AGPL) o rasterizar con pdf.js (pierde el texto seleccionable).
- **Dificultad:** media-alta. **Anuncios:** bajos (visita de 20 segundos).

### 5. Unir / dividir / reordenar PDF
- **Demanda:** **A**. **Competencia:** saturada (iLovePDF y PDF24 son gratis y dominan Google).
- **¿Sin servidor?** Sí, trivial con pdf-lib. **Dificultad:** baja. **Anuncios:** bajos.

### 6. Firmar un PDF
- **De pago hoy:** DocuSign, Smallpdf (2 documentos/día sin cuenta)
  ([fuente](https://smallpdf.com/es/blog/firmar-documento-online)).
- **Demanda:** **C**. **Competencia:** alta, ya hay opciones gratis sin límite (iLovePDF, PDFgear, varios nichos).
- **¿Sin servidor?** Sí (pdf-lib + canvas). Solo firma "dibujada", no firma electrónica cualificada.
- **Dificultad:** baja-media. **Anuncios:** bajos-medios.

### 7. Comprimir vídeo
- **De pago hoy:** muchas webs limitan a 500 MB o 30 min, o ponen marca de agua
  ([fuente](https://www.media.io/es/watermark-remover-tips/best-free-video-compressor-online-no-watermark.html)).
- **Demanda:** **B**. **Competencia:** alta.
- **¿Sin servidor?** Sí con ffmpeg.wasm o WebCodecs, pero **muy lento** en el navegador (ffmpeg.wasm va 10–20×
  más lento que nativo), y en móvil peor. ffmpeg.wasm multihilo necesita cabeceras COOP/COEP que GitHub Pages no
  permite configurar.
- **Dificultad:** media-alta. **Anuncios:** buenos (espera larga) pero la experiencia puede frustrar.

### 8. Extraer audio de un vídeo / vídeo a MP3
- **Demanda:** **B**. **Competencia:** alta (y zona gris con descargadores de vídeos de terceros).
- **¿Sin servidor?** Sí (ffmpeg.wasm o WebAudio + encoder MP3 en WASM). **Dificultad:** media. **Anuncios:** medios.

### 9. Comprimir y redimensionar imágenes (JPG/PNG/WebP)
- **De pago hoy:** TinyPNG (gratis 20 imágenes de 5 MB por vez; Pro de pago).
- **Demanda:** **B**. **Competencia:** alta (Squoosh gratis, iLoveIMG…).
- **¿Sin servidor?** Sí (canvas, códecs WASM). **Dificultad:** baja. **Anuncios:** bajos.

### 10. Convertir HEIC a JPG
- **Demanda:** **C** (fotos de iPhone). **Competencia:** media-alta (muchas webs gratuitas).
- **¿Sin servidor?** Sí (libheif en WASM). **Dificultad:** baja-media. **Anuncios:** bajos.

### 11. OCR: pasar imagen o PDF escaneado a texto
- **De pago hoy:** muchos OCR online limitan páginas/día; Adobe Acrobat Pro.
- **Demanda:** **B** ("pasar imagen a texto", "extraer texto de imagen"). **Competencia:** media-alta.
- **¿Sin servidor?** Sí (tesseract.js, Apache-2.0), aunque la calidad es inferior a los OCR en la nube.
- **Dificultad:** baja-media. **Anuncios:** medios.

### 12. Ampliar/mejorar imágenes con IA (upscale)
- **De pago hoy:** muchas webs por créditos.
- **Demanda:** **C**. **Competencia:** alta.
- **¿Sin servidor?** Posible (Real-ESRGAN en ONNX), pero lento, consume mucha memoria y falla en móviles.
- **Dificultad:** media-alta. **Anuncios:** medios.

### 13. Texto a voz natural
- **De pago hoy:** ElevenLabs y similares (voces realistas de pago).
- **Demanda:** **B** ("texto a voz", "convertir texto a audio"). **Competencia:** alta y la calidad de pago es muy
  superior.
- **¿Sin servidor?** Sí (Piper/Kokoro en WASM), pero las voces en español de calidad son pocas y algunas tienen
  licencias restrictivas.
- **Dificultad:** media. **Anuncios:** medios.

### 14. Quitar ruido de un audio
- **De pago hoy:** herramientas de "mejora de voz" con límites de minutos.
- **Demanda:** **C/D**. **Competencia:** media.
- **¿Sin servidor?** Sí (RNNoise en WASM, BSD). **Dificultad:** media. **Anuncios:** medios.

### 15. Grabar la pantalla
- **De pago hoy:** Loom (vídeos gratis limitados a pocos minutos), otros grabadores con marca de agua.
- **Demanda:** **B** ("grabar pantalla pc"). **Competencia:** media (el sistema operativo ya trae uno).
- **¿Sin servidor?** Sí (getDisplayMedia + MediaRecorder). **No funciona en móvil** (la API no existe allí).
- **Dificultad:** baja. **Anuncios:** medios-bajos (la pestaña queda en segundo plano mientras grabas).

### 16. Creador de currículum (CV) en PDF
- **De pago hoy:** muchas webs "gratis" que cobran al descargar (suscripciones de 2–3 € que se renuevan a
  ~25 €/mes), una queja muy extendida.
- **Demanda:** **A** ("hacer curriculum", "curriculum vitae gratis", "plantilla cv").
- **Competencia:** muy alta y con presupuestos de SEO/SEM enormes; también Canva gratis.
- **¿Sin servidor?** Sí (formulario + impresión a PDF). **Dificultad:** media (plantillas bonitas cuestan).
- **Anuncios:** buenos (nicho empleo, visita larga).

### 17. Generador de facturas en PDF
- **Demanda:** **C** (autónomos). **Competencia:** alta (programas de facturación con plan gratis).
- **¿Sin servidor?** Sí. **Riesgo:** en España la normativa VeriFactu exige requisitos a los programas de
  facturación → riesgo legal para una web gratuita.
- **Dificultad:** media. **Anuncios:** buenos (RPM finanzas) pero el riesgo lo descarta.

### 18. Generador de códigos QR que no caducan
- **De pago hoy:** muchos generadores crean QR "dinámicos" que dejan de funcionar si no pagas (queja habitual).
- **Demanda:** **A** ("generar código qr"). **Competencia:** saturada.
- **¿Sin servidor?** Sí, trivial. **Dificultad:** muy baja. **Anuncios:** bajos (visita de 10 segundos).

### 19. Borrar objetos o marcas de agua de fotos (inpainting)
- **Demanda:** **B**. **Competencia:** alta.
- **¿Sin servidor?** Posible (LaMa en ONNX, ~200 MB), lento en móvil.
- **Riesgo:** quitar marcas de agua ajenas puede facilitar infracciones de derechos de autor → problemas con
  AdSense. **Descartada.**

---

## Tabla de puntuación

Escala 1–5 en cada criterio (5 = mejor). Demanda: A=5, B=4, C=3, D=2.

| # | Idea | Demanda (30 %) | Compet. débil (15 %) | Sin servidor (15 %) | Facilidad (10 %) | Anuncios (20 %) | Sustituye pago (10 %) | **Total** |
|---|---|---|---|---|---|---|---|---|
| 1 | **Transcribir audio/vídeo a texto (+ subtítulos)** | 5 | 3 | 4 | 3 | 5 | 5 | **4,35** |
| 16 | Creador de CV | 5 | 1 | 5 | 3 | 4 | 4 | 3,90 |
| 2 | Subtítulos automáticos (sola) | 3 | 3 | 4 | 3 | 4 | 5 | 3,55 |
| 11 | OCR imagen a texto | 4 | 2 | 4 | 4 | 3 | 3 | 3,40 |
| 15 | Grabar pantalla | 4 | 3 | 3 | 5 | 2 | 4 | 3,40 |
| 5 | Unir/dividir PDF | 5 | 1 | 5 | 5 | 1 | 2 | 3,30 |
| 18 | Códigos QR que no caducan | 5 | 1 | 5 | 5 | 1 | 2 | 3,30 |
| 8 | Vídeo a MP3 | 4 | 2 | 4 | 3 | 3 | 2 | 3,20 |
| 7 | Comprimir vídeo | 4 | 2 | 2 | 2 | 4 | 4 | 3,20 |
| 3 | Quitar fondo | 5 | 1 | 2 | 3 | 3 | 3 | 3,15 |
| 13 | Texto a voz | 4 | 2 | 3 | 3 | 3 | 3 | 3,15 |
| 17 | Facturas PDF | 3 | 2 | 5 | 3 | 3 | 3 | 3,15 → descartada por riesgo legal |
| 6 | Firmar PDF | 3 | 2 | 5 | 4 | 2 | 3 | 3,05 |
| 9 | Comprimir imágenes | 4 | 1 | 5 | 5 | 1 | 2 | 3,00 |
| 14 | Quitar ruido de audio | 2 | 3 | 5 | 3 | 3 | 3 | 3,00 |
| 19 | Borrar marcas de agua | 4 | 2 | 2 | 2 | 3 | 3 | 2,90 → descartada por riesgo de políticas |
| 10 | HEIC a JPG | 3 | 2 | 5 | 4 | 1 | 2 | 2,75 |
| 4 | Comprimir PDF | 5 | 1 | 2 | 2 | 1 | 3 | 2,65 |
| 12 | Ampliar imágenes IA | 3 | 2 | 2 | 2 | 3 | 3 | 2,60 |

(Ejemplo de cálculo para la nº 1: 5·0,30 + 3·0,15 + 4·0,15 + 3·0,10 + 5·0,20 + 5·0,10 = 4,35.)

---

## Ganadora: **transcribir audio y vídeo a texto (con subtítulos SRT/VTT), 100 % en el navegador**

Por qué:

1. **Demanda enorme en español y muy "long tail":** "pasar audio a texto", "transcribir audio", "transcribir
   nota de voz", "transcribir vídeo", "generar subtítulos", "transcribir entrevista", "transcribir clase"…
   Cada variante es una página/sección posible.
2. **Los competidores cobran de verdad o limitan mucho:** Otter (3 importaciones de archivo en toda la vida de la
   cuenta gratuita), TurboScribe (3 archivos al día), VEED (SRT solo en Pro, marca de agua), Happy Scribe (de pago
   por minuto). Nosotros: sin límite de archivos ni de minutos, sin registro.
3. **Diferenciación real y difícil de copiar para ellos:** su modelo de negocio depende de procesar en su
   servidor; el nuestro no tiene coste por usuario, así que podemos ser ilimitados. Además **el audio no sale del
   dispositivo**, algo muy valioso para periodistas, abogados, médicos, estudiantes o para notas de voz personales.
4. **Coste cero de verdad:** web estática en GitHub Pages; el modelo se sirve desde el CDN público de Hugging Face
   y el motor desde jsDelivr; el procesamiento lo pone el dispositivo del usuario.
5. **Ideal para anuncios:** transcribir lleva de segundos a varios minutos → la página está abierta y visible
   mucho tiempo → más impresiones y mejor "viewability" que una herramienta de 10 segundos.
6. **Licencias limpias:** Whisper (MIT) y Transformers.js (Apache-2.0) permiten uso comercial.

Riesgos y cómo los mitigamos:

| Riesgo | Mitigación |
|---|---|
| Móviles antiguos lentos o sin memoria | Tres calidades de modelo (rápido ≈ 40 MB, equilibrado ≈ 80 MB, preciso ≈ 250 MB); por defecto "rápido" en móvil. Aviso honesto de tiempos. |
| Descarga inicial del modelo | Se hace una sola vez y queda en la caché del navegador; barra de progreso. |
| Precisión inferior a servicios de pago | Se dice claramente en las FAQ; se permite elegir el modelo preciso y editar el texto antes de exportar. |
| Sin WebGPU (Safari antiguo, Firefox) | Alternativa automática a WebAssembly. |
| Formatos raros | Se usa el decodificador del navegador (MP3, WAV, M4A, AAC, OGG/Opus, FLAC, WebM, MP4…). Se informa si no puede. |

Idea para el futuro (misma web, más tráfico): añadir OCR (nº 11) y grabación de voz, reutilizando la misma
estructura de páginas, anuncios y textos legales.

## Fuentes

- [Xataka – 19 herramientas gratis para transcribir audio a texto](https://www.xataka.com/basics/transcribir-audio-a-texto-17-herramientas-gratuitas)
- [Otter.ai pricing 2026 (tl;dv)](https://tldv.io/blog/otter-pricing/) · [TurboScribe vs Otter 2026](https://convertaudiototext.com/blog/turboscribe-vs-otter)
- [Transcribir en el navegador con Transformers.js](https://whisperstt.com/blog/transcribe-audio-in-browser/) · [Whisper + WebGPU](https://senoritadeveloper.medium.com/whisper-webgpu-2b1cadfab897) · [DEV: transcripción privada con Transformers.js](https://dev.to/fzsheik/how-i-built-a-private-audio-transcription-tool-in-browser-using-transformersjs-1fl0)
- [remove.bg](https://www.remove.bg/es) · [Cutout.pro](https://www.cutout.pro/remove-background) · [Licencia de background-removal-js](https://github.com/imgly/background-removal-js) · [Licencias RMBG / imgly](https://github.com/backblaze-b2-samples/b2-transformerjs-background-removal)
- [Smallpdf comprimir](https://smallpdf.com/es/comprimir-pdf) · [iLovePDF comprimir](https://www.ilovepdf.com/es/comprimir_pdf) · [PDF24](https://tools.pdf24.org/es/comprimir-pdf)
- [Smallpdf firmar (límite 2/día)](https://smallpdf.com/es/blog/firmar-documento-online) · [Firmar PDF gratis 2026](https://pdf.wondershare.es/sign-pdf/free-pdf-signature-software.html)
- [Compresores de vídeo sin marca de agua](https://www.media.io/es/watermark-remover-tips/best-free-video-compressor-online-no-watermark.html)
- [Generadores de subtítulos (límites VEED/Kapwing)](https://dc.wondershare.es/auto-caption/online-subtitle-generator.html) · [Kapwing subtítulos](https://www.kapwing.com/subtitles)
- [Cuánto paga AdSense por 1000 visitas en 2026](https://sergiocanales.com/cuanto-paga-google-adsense-por-1000-visitas/)
