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
npm i --no-save playwright mediabunny@1.60.0 axe-core
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
- **URL pública y ruta base** (`site.config.json`):
  ```json
  "siteOrigin": "https://xabiouteda-ui.github.io",
  "basePath": "/Gamee/"
  ```
  Juntos forman la URL pública (`https://xabiouteda-ui.github.io/Gamee/`), que se usa **solo** para las URLs
  absolutas: canonical, hreflang, sitemap, Open Graph y la página 404. Todo lo demás (enlaces entre páginas, CSS,
  JS, el worker, imágenes) usa rutas relativas, así que la web funciona igual en una subcarpeta o en la raíz. Las
  pruebas fallan si alguna página, CSS o JS usa una ruta que empiece por `/`.
- **Importante:** `basePath` debe coincidir exactamente con el nombre del repositorio (mayúsculas incluidas). Si
  renombras el repositorio, cambia también `basePath`. Si no coinciden, el workflow muestra un aviso (la web
  funciona, pero canonical y sitemap apuntarían a otra URL y Google no la indexaría bien).
- También puedes cambiarlos sin tocar código con las variables `SITE_ORIGIN` y `BASE_PATH` en **Settings → Secrets
  and variables → Actions → Variables**.

### Dominio propio (recomendado para AdSense)

AdSense no acepta subdominios de `github.io` como sitio propio (y `ads.txt` debe estar en la raíz del dominio),
así que para monetizar necesitas un dominio (unos 10 €/año, es el único coste):

1. En **Settings → Pages → Custom domain** escribe tu dominio y guarda.
2. En tu proveedor de dominio crea los registros DNS que indica GitHub (CNAME a `TU_USUARIO.github.io`
   para `www`, o registros A para el dominio raíz) y activa **Enforce HTTPS**.
3. En `site.config.json` pon `"siteOrigin": "https://www.tudominio.com"` y `"basePath": "/"` (o las variables
   `SITE_ORIGIN` y `BASE_PATH`) y vuelve a publicar.
4. Da de alta el dominio en Google Search Console y envía `https://tudominio.com/sitemap.xml`.

Mientras la web esté en una subcarpeta de `github.io`, `robots.txt` y `ads.txt` no están en la raíz del dominio y
los buscadores los ignoran: envía el sitemap a mano en Search Console (`https://xabiouteda-ui.github.io/Gamee/sitemap.xml`).

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

## Límites conocidos

- La precisión depende del modelo elegido y de la calidad del audio; no distingue entre hablantes.
- Sin WebGPU (Firefox, Safari antiguo) se usa WebAssembly en un solo hilo: funciona, pero es más lento.
- Archivos muy largos pueden agotar la memoria en móviles.
- Necesita conexión para descargar la librería (jsDelivr) y el modelo (Hugging Face) la primera vez.
