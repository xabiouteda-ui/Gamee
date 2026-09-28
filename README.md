# Transcribe Libre

Herramienta web **gratuita** para pasar audio y vídeo a texto y generar subtítulos (SRT/VTT).
Funciona **100 % en el navegador** con Whisper (Transformers.js + WebGPU/WebAssembly): el audio nunca se sube a
ningún servidor. Web estática para GitHub Pages, sin costes, monetizable con Google AdSense.

- Por qué esta herramienta: [`RESEARCH.md`](RESEARCH.md) (19 ideas evaluadas y puntuadas).
- Decisiones técnicas y de producto: [`DECISIONS.md`](DECISIONS.md).

## Estructura

```
site.config.json        Nombre, URL y datos del titular (para las páginas legales)
assets/js/config.js     Configuración de AdSense (desactivado por defecto)
assets/js/app.js        Interfaz de la herramienta
assets/js/worker.js     IA en un Web Worker (carga Whisper y transcribe por fragmentos)
assets/js/format.js     Exportación TXT / SRT / VTT
assets/js/i18n.js       Textos de la herramienta en español e inglés
assets/js/ads.js        Rellena los huecos de anuncios si están activados
assets/css/style.css    Estilos (claro/oscuro automático, móvil primero)
src/pages/es|en/*.html  Contenido de cada página (título y descripción SEO en la cabecera JSON)
src/partials/tool.html  HTML de la herramienta
build.mjs               Genera _site/ (plantilla, SEO, hreflang, sitemap, robots, ads.txt)
tests/                  Comprobaciones estáticas y prueba end-to-end
.github/workflows/      Publicación automática en GitHub Pages
```

## Probar en local

Necesitas Node.js 18 o superior. No hay dependencias que instalar.

```bash
node build.mjs            # genera _site/
npx serve _site           # o: python3 -m http.server -d _site 8080
```

Abre la dirección que te indique y prueba con cualquier audio. La primera transcripción descarga el modelo
(40–250 MB según la calidad).

Pruebas:

```bash
node tests/check-site.mjs          # SEO, enlaces rotos, JSON-LD, formatos de exportación
npm i --no-save playwright && node tests/e2e.cjs   # flujo completo en Chromium
```

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub y fusiona el código en la rama `main`.
2. En GitHub: **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
3. Cada push a `main` ejecuta `.github/workflows/deploy.yml`: genera la web, pasa las comprobaciones y la publica.
   También puedes lanzarlo a mano en **Actions → Publicar en GitHub Pages → Run workflow**.
4. La web queda en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`.

### Antes de publicar de verdad

- Rellena `site.config.json`: `ownerName`, `ownerId`, `ownerAddress` y `contactEmail` aparecen en el aviso legal,
  la privacidad y el contacto. **AdSense rechaza webs con datos de contacto de relleno.**
- `siteUrl` se usa para canonical, sitemap y Open Graph. El workflow ya usa automáticamente la URL de GitHub
  Pages; si usas un dominio propio, crea la variable `SITE_URL` en **Settings → Secrets and variables → Actions →
  Variables** (por ejemplo `https://www.tudominio.com`) o cambia `siteUrl`.

### Dominio propio (recomendado para AdSense)

AdSense no acepta subdominios de `github.io` como sitio propio (y `ads.txt` debe estar en la raíz del dominio),
así que para monetizar necesitas un dominio (unos 10 €/año, es el único coste):

1. En **Settings → Pages → Custom domain** escribe tu dominio y guarda.
2. En tu proveedor de dominio crea los registros DNS que indica GitHub (CNAME a `TU_USUARIO.github.io`
   para `www`, o registros A para el dominio raíz) y activa **Enforce HTTPS**.
3. Crea la variable `SITE_URL` con tu dominio (ver arriba) y vuelve a publicar.
4. Da de alta el dominio en Google Search Console y envía `https://tudominio.com/sitemap.xml`.

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

- **Nombre de la web:** `siteName` en `site.config.json` (y el texto de `assets/img/og.png` si quieres).
- **Textos de la herramienta:** `assets/js/i18n.js` (mismas claves en `es` y `en`; la prueba lo comprueba).
- **Nueva página:** crea `src/pages/es/mi-pagina.html` con una cabecera como esta y vuelve a ejecutar el build:
  ```html
  <!--{ "slug": "mi-pagina.html", "title": "Título SEO (≤70)", "description": "Descripción (50–170)", "tool": true }-->
  <h1>…</h1>
  {{tool}}          ← opcional: inserta la herramienta
  {{ad:content}}    ← opcional: hueco de anuncio
  ```
  Usa `"alt": "en/otra.html"` para enlazar la versión en otro idioma (hreflang) y `"faqSchema": true` para generar
  datos estructurados de preguntas frecuentes a partir de los `<details>`.

## Límites conocidos

- La precisión depende del modelo elegido y de la calidad del audio; no distingue entre hablantes.
- Sin WebGPU (Firefox, Safari antiguo) se usa WebAssembly en un solo hilo: funciona, pero es más lento.
- Archivos muy largos pueden agotar la memoria en móviles.
- Necesita conexión para descargar la librería (jsDelivr) y el modelo (Hugging Face) la primera vez.
