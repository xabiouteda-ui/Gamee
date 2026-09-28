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
22. **URL base configurable** (`siteUrl` en `site.config.json`) para canonical, sitemap y Open Graph. Todos los enlaces
    internos son relativos, así que funciona tanto en `usuario.github.io/repo/` como en un dominio propio.
