# Auditoría SEO técnica – herramientaslibres.es (29/09/2026)

Revisión de las 39 páginas generadas. ✅ = ya estaba bien · 🔧 = arreglado en esta sesión · 👤 = te toca a ti.

## Rastreo e indexación
| Punto | Estado |
|---|---|
| Dominio propio en canonical, hreflang, sitemap, Open Graph y 404 | 🔧 `herramientaslibres.es` en todo; una prueba falla si queda algo de `github.io` |
| `robots.txt` en la raíz, con el sitemap | 🔧 |
| `ads.txt` en la raíz | 🔧 (sin ID de AdSense, solo un comentario) |
| Sitemap con `lastmod` real | 🔧 fecha del último commit de cada página; las de precios diarios, la de los datos |
| IndexNow (Bing, Yandex, Seznam, Naver) | 🔧 archivo de clave en la raíz + aviso automático tras cada publicación |
| Páginas `noindex` fuera del sitemap (404, widget, Pro apagado) | ✅ |
| hreflang es/en recíproco con `x-default` | ✅ |
| Alta en Google Search Console y Bing Webmaster Tools | 👤 propiedad de dominio (registro DNS TXT) y enviar `/sitemap.xml` |

## Contenido en la página
| Punto | Estado |
|---|---|
| Un solo `<h1>` por página | ✅ (prueba automática) |
| Títulos ≤ 65 caracteres | 🔧 había 8 de 66–71 que Google cortaba; ahora la prueba exige ≤ 65 |
| Marca uniforme | 🔧 7 páginas decían «Transcribe Libre» (nombre antiguo): ahora «Herramientas Libres» |
| Títulos y descripciones únicos | 🔧 prueba automática nueva |
| Descripciones de 50–170 caracteres | ✅ |
| Enlazado interno | 🔧 migas de pan visibles + bloque «Guías relacionadas» con todas las páginas de la sección |

## Datos estructurados
| Tipo | Dónde |
|---|---|
| `WebApplication` (gratis, 0 €) | ✅ cada herramienta |
| `FAQPage` | ✅ páginas con preguntas frecuentes |
| `BreadcrumbList` | 🔧 nuevo, en todas las guías |
| `Organization` con logo | 🔧 portada |
| `Dataset` (PVPC horario, descargable en JSON) | 🔧 «precio de la luz hoy», «mañana» y el estudio 2026 |

Nota: Google ya casi no muestra resultados enriquecidos de FAQ salvo en webs de salud y gobierno; se mantienen
porque no molestan y otros buscadores los usan.

## Redes sociales
| Punto | Estado |
|---|---|
| Imagen Open Graph propia por página (1200×630) | 🔧 `scripts/og-images.mjs` genera una por página con su título; la prueba falla si falta |
| `og:image:width/height/alt` | 🔧 |

## Core Web Vitals (medido en local con Chromium, móvil 390 px y escritorio 1280 px)
| Métrica | Resultado |
|---|---|
| CLS | 0,00–0,02 en las 7 páginas principales (bueno < 0,1) |
| Huecos de anuncios | 🔧 al activar AdSense el hueco se reserva desde el HTML (sin salto al cargar) |
| JS de terceros sin anuncios | ✅ ninguno (GoatCounter solo si lo activas: 1 script async de ~3 KB) |
| Imágenes pesadas | ✅ la web no usa imágenes en el contenido; las OG no se cargan al navegar |

No se ha podido medir con datos reales de usuarios (CrUX): la web es nueva. Revisa **Search Console → Métricas web
principales** dentro de un mes.

## Pendiente (👤)
1. Search Console + Bing Webmaster Tools, enviar el sitemap.
2. Settings → Pages → **Enforce HTTPS**.
3. Rellenar tus datos reales en `site.config.json` (aviso legal y contacto): AdSense y Google lo valoran.
