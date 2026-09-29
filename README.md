# Herramientas Libres

Web de **herramientas gratuitas que funcionan 100 % en el navegador** (sin servidor, sin subir archivos), alojada
en GitHub Pages y monetizable con Google AdSense:

| Herramienta | URL | Qué hace |
|---|---|---|
| Transcribe Libre | `/pasar-audio-a-texto/` (+ `/en/audio-to-text/`) | Audio/vídeo → texto, SRT y VTT con Whisper |
| Subtítulos animados | `/subtitulos-animados/` (+ `/en/animated-captions/`) | Subtítulos karaoke grabados en el vídeo (MP4) |
| ¿Qué tarifa de luz me conviene? | `/luz/` | Analiza el CSV de consumo y compara ofertas |

La portada (`/`) agrupa las herramientas bajo la marca común.

- Investigación: [`RESEARCH.md`](RESEARCH.md) (primera herramienta) y [`RESEARCH-2.md`](RESEARCH-2.md) (las dos nuevas).
- Decisiones: [`DECISIONS.md`](DECISIONS.md). Estado y siguientes pasos: [`PROGRESS.md`](PROGRESS.md).

## Estructura

```
site.config.json        Nombre, URL y datos del titular (para las páginas legales)
assets/js/config.js     Configuración de AdSense (desactivado por defecto)
assets/js/app.js        Interfaz del transcriptor
assets/js/worker.js     IA en un Web Worker (Whisper; por frases o palabra a palabra), compartido
assets/js/captions/     Subtítulos animados: core.js (tiempos, estilos, dibujo), app.js (UI y exportación), i18n.js
assets/js/luz/          Tarifa de luz: core.js (periodos 2.0TD, CSV, facturas; RULES con impuestos), app.js, i18n.js
assets/fonts/           Fuentes OFL para los subtítulos
assets/js/format.js     Exportación TXT / SRT / VTT
assets/js/i18n.js       Textos de la herramienta en español e inglés
assets/js/ads.js        Rellena los huecos de anuncios si están activados
assets/css/style.css    Estilos (claro/oscuro automático, móvil primero)
src/pages/es|en/*.html  Contenido de cada página (título y descripción SEO en la cabecera JSON)
src/partials/*.html     HTML de cada herramienta (tool.html, captions.html, luz.html)
build.mjs               Genera _site/ (plantilla, SEO, hreflang, sitemap, robots, ads.txt)
tests/                  Comprobaciones estáticas y prueba end-to-end
.github/workflows/      Publicación automática en GitHub Pages
```

## Probar en local

Necesitas Node.js 18 o superior. No hay dependencias que instalar.

```bash
node build.mjs            # genera _site/
npx serve _site           # las rutas son relativas: funciona también desde la raíz
```

Abre la dirección que te indique y prueba con cualquier audio. La primera transcripción descarga el modelo
(40–250 MB según la calidad).

Pruebas:

```bash
node tests/check-site.mjs          # SEO, enlaces rotos, rutas "/..." absolutas, JSON-LD, exportación
node tests/unit-captions.mjs       # lógica de los subtítulos animados
node tests/unit-luz.mjs            # periodos 2.0TD, lectura de CSV y cálculo de facturas
node tests/unit-monetizacion.mjs   # afiliados, patrocinados, placas, licencias Pro, Word y Telegram
npm i --no-save playwright mediabunny@1.60.0 axe-core
bash tests/run-all.sh              # todo seguido; se detiene en el primer fallo
node tests/e2e.cjs                 # transcriptor en Chromium, servido bajo basePath
node tests/e2e-captions.cjs        # subtítulos animados: genera, exporta y revisa un vídeo real
node tests/e2e-luz.cjs             # analizador de consumo eléctrico
node tests/e2e-a11y.cjs            # accesibilidad (axe-core) de todas las páginas, claro y oscuro
```

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub y fusiona el código en la rama `main`.
2. En GitHub: **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
3. Cada push a `main` ejecuta `.github/workflows/deploy.yml`: genera la web, pasa las comprobaciones y la publica.
   También puedes lanzarlo a mano en **Actions → Publicar en GitHub Pages → Run workflow**.
4. La web queda en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/` (GitHub respeta mayúsculas y minúsculas del
   nombre del repositorio).

### Antes de publicar de verdad

- Rellena `site.config.json`: `ownerName`, `ownerId`, `ownerAddress` y `contactEmail` aparecen en el aviso legal,
  la privacidad y el contacto. **AdSense rechaza webs con datos de contacto de relleno.**
- **URL pública:** la web está en **https://herramientaslibres.es** (`site.config.json` → `"siteOrigin":
  "https://herramientaslibres.es"`, `"basePath": "/"`; en Actions también lo fijan las variables `SITE_ORIGIN` y
  `BASE_PATH`). Se usa **solo** para las URLs absolutas: canonical, hreflang, sitemap, Open Graph, 404, widget,
  crédito de los vídeos y Telegram. Todo lo demás usa rutas relativas, así que la web también funcionaría en una
  subcarpeta (las pruebas fallan si algo usa una ruta que empiece por `/`).
- Si la URL configurada no coincide con la que GitHub Pages asigna al repositorio, el workflow muestra un aviso.
  Si solo cambia `http`/`https`, muestra una nota para activar **Settings → Pages → Enforce HTTPS**.

### Dominio propio

1. **Settings → Pages → Custom domain**: `herramientaslibres.es` (hecho). Activa **Enforce HTTPS** cuando GitHub lo
   permita.
2. `robots.txt` y `ads.txt` se generan en la raíz del dominio en cada publicación.
3. Da de alta el dominio en Google Search Console (propiedad de dominio) y en Bing Webmaster Tools, y envía
   `https://herramientaslibres.es/sitemap.xml`.

## Activar los anuncios (Google AdSense)

1. Crea una cuenta en AdSense, añade tu dominio y espera la aprobación. Mientras tanto, AdSense te pedirá
   verificar el sitio: la forma más sencilla es el archivo `ads.txt` (paso 3).
2. En AdSense, crea **bloques de anuncios de display** (adaptables). Hay cuatro huecos preparados:
   | Hueco | Dónde aparece |
   |---|---|
   | `top` | Debajo de la cabecera |
   | `result` | Justo debajo de la herramienta (visible mientras se transcribe) |
   | `content` | En mitad del texto de la página |
   | `bottom` | Antes del pie de página |
3. Edita `assets/js/config.js`:
   ```js
   window.SITE_CONFIG = {
     adsEnabled: true,
     adsenseClient: "ca-pub-1234567890123456",
     slots: { top: "1111111111", result: "2222222222", content: "3333333333", bottom: "4444444444" }
   };
   ```
   Un hueco con ID vacío no muestra nada. Al publicar, el build genera `/ads.txt` con tu ID.
4. Haz commit y push a `main`. Mientras `adsEnabled` sea `false` no se carga ningún script de Google.
5. **Consentimiento de cookies (obligatorio en la UE/Reino Unido):** en AdSense ve a **Privacidad y mensajes →
   Europa** y crea y publica un mensaje de consentimiento (CMP de Google, gratis). No hace falta tocar el código:
   se muestra automáticamente con el script de AdSense.
6. **Anuncios automáticos (alternativa):** si prefieres que Google decida dónde colocarlos, pon `adsEnabled: true`
   y tu `adsenseClient`, deja los `slots` vacíos y activa "Anuncios automáticos" en el panel de AdSense.

Consejos para la aprobación: rellena los datos del titular, publica en un dominio propio, espera a tener algo de
tráfico orgánico e indexación en Search Console, y no pulses tus propios anuncios.

## Cambiar textos, nombre o añadir páginas

- **Nombre de la web:** `siteName` en `site.config.json` (y el texto de `assets/img/og.jpg` si quieres).
- **Impuestos de la luz:** `RULES` en `assets/js/luz/core.js` (revisar cada año; la fecha se muestra en la página).
- **Textos de la herramienta:** `assets/js/i18n.js` (mismas claves en `es` y `en`; la prueba lo comprueba).
- **Nueva página:** crea `src/pages/es/mi-pagina.html` con una cabecera como esta y vuelve a ejecutar el build:
  ```html
  <!--{ "slug": "mi-pagina.html", "title": "Título SEO (≤70)", "description": "Descripción (50–170)", "tool": true }-->
  <h1>…</h1>
  {{tool}}          ← opcional: inserta la herramienta
  {{ad:content}}    ← opcional: hueco de anuncio
  ```
  `"tool"` puede ser `true` (transcriptor), `"captions"` o `"luz"`.
  Usa `"alt": "en/otra.html"` para enlazar la versión en otro idioma (hreflang) y `"faqSchema": true` para generar
  datos estructurados de preguntas frecuentes a partir de los `<details>`.

## Monetización (todo desactivado por defecto)

Además de AdSense hay cinco vías preparadas. Ninguna se ve ni hace peticiones a terceros hasta que la activas.
Cómo se explica al público: página `/como-ganamos-dinero.html` (enlazada en el pie).

### Enlaces de afiliado (`data/afiliados.json`)

Recomendaciones de texto que salen **solo en la pantalla de resultado** (tras exportar un vídeo con subtítulos y tras
transcribir), con la etiqueta «Enlace de afiliado» y `rel="sponsored nofollow"`. Para activar una: date de alta en
su programa de afiliados, pega tu enlace en `"url"` (con `https://`), pon `"enabled": true` en esa entrada y
`"enabled": true` arriba del todo. Puedes cambiar los textos o añadir entradas copiando una (`"where"`:
`"subtitulos"` y/o `"transcripcion"`).

### Ofertas de luz patrocinadas (`data/ofertas.json`)

Si una comercializadora te paga por contrato: en su tarifa pon `"sponsored": true` y `"affiliateUrl": "https://…"`,
y arriba `"sponsoredEnabled": true`. Se marca como «Patrocinado» y aparece en el hueco «Ofertas patrocinadas» con
**su puesto real por precio**: nunca sube en la lista (lo exige la ley de consumidores). El bloque de placas solares
usa los parámetros de `"solar"` en el mismo archivo.

### Versión Pro de pago único (`data/pro.json`)

1. Crea las claves: `node scripts/pro-keys.mjs init`. Guarda `pro-private-key.json` en un sitio seguro (gestor de
   contraseñas): **no se sube a git** (está en `.gitignore`). La clave pública queda en `data/pro.json`.
2. Crea el producto en **Paddle** o **Stripe (Managed Payments)** como pago único y copia su enlace de pago en
   `"checkoutUrl"`; en `"provider"` pon `"paddle"` o `"stripe"`. Ellos cobran y gestionan el IVA de la UE.
3. Pon el precio que decidas en `"price"` (texto, p. ej. `"24 €, IVA incluido"`) y `"enabled": true`. Commit y push:
   `/pro.html` pasa a indexarse y las funciones Pro aparecen (bloqueadas) en las herramientas.
4. Por cada venta, genera una clave con `node scripts/pro-keys.mjs issue` y envíasela al comprador. Él la pega en
   `/pro.html` y queda activada en su navegador.

Pro desbloquea: fuentes propias, kit de marca guardado, estilos «Titular» y «Suave», exportación hasta 4K, varios
vídeos seguidos, exportar la transcripción a Word y el crédito quitado por defecto. Todo lo gratis sigue gratis.

### Crédito «Hecho con Herramientas Libres»

Pequeña marca en la esquina superior de los vídeos exportados, activada por defecto y que cualquiera puede quitar con
una casilla. Con dominio propio añade el dominio automáticamente.

### Canal de Telegram «Precio de la luz mañana»

`.github/workflows/telegram.yml` publica cada día a las 20:40 (hora de Madrid) las horas más baratas y más caras de
mañana. Para activarlo:

1. En Telegram, habla con **@BotFather** → `/newbot` → elige nombre y usuario. Te da un **token** (`123456:ABC…`).
2. Crea un **canal** público (p. ej. `@precioluzmanana`) y añade tu bot como **administrador** con permiso para
   publicar mensajes.
3. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - `TELEGRAM_BOT_TOKEN` = el token del paso 1.
   - `TELEGRAM_CHAT_ID` = el nombre del canal con `@` (p. ej. `@precioluzmanana`). Para un canal privado usa su
     identificador numérico (empieza por `-100`).
4. Pruébalo en **Actions → Precio de la luz mañana en Telegram → Run workflow** (a partir de las 20:30, cuando REE
   ya ha publicado los precios de mañana).

Sin los secretos el workflow termina bien sin publicar nada. Los horarios programados solo funcionan en `main`.

### Widget «precio de la luz hoy»

Página `/luz/widget-precio-luz.html` con la vista previa y el código para copiar (un `iframe` a
`/widget/luz-hoy.html` + un enlace de atribución a la página de precios). Opción `?tema=claro|oscuro`. Usa
`data/pvpc-hoy.json` (≈1 KB, lo genera el build) para no descargar el año entero en webs ajenas.

## Límites conocidos

- La precisión depende del modelo elegido y de la calidad del audio; no distingue entre hablantes.
- Sin WebGPU (Firefox, Safari antiguo) se usa WebAssembly en un solo hilo: funciona, pero es más lento.
- Archivos muy largos pueden agotar la memoria en móviles.
- Necesita conexión para descargar la librería (jsDelivr) y el modelo (Hugging Face) la primera vez.
