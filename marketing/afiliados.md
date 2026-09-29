# Programas de afiliados

Datos consultados el **29/09/2026** en las webs de cada programa o en fichas de terceros: **las comisiones y
condiciones cambian; confírmalas en la página de alta**. Cuando te acepten, pega tu enlace en
`data/afiliados.json` (subtítulos/transcripción) o `data/ofertas.json` (luz) y activa ese elemento (README →
«Monetización»). Se muestran marcados como «Enlace de afiliado» / «Patrocinado» y con `rel="sponsored"`.

Antes de cobrar comisiones: consulta a un gestor el alta fiscal. Casi todos pagan en dólares por PayPal o
transferencia.

## Qué hueco de la web ocupa cada uno

| Hueco en `data/afiliados.json` | Programa recomendado | Por qué encaja |
|---|---|---|
| `voz-doblaje` / `traduccion` | **ElevenLabs** | Tras hacer subtítulos, doblar el vídeo a otro idioma |
| `clips-automaticos` | **OpusClip** (o Submagic) | Sacar clips de un vídeo largo antes de subtitularlos |
| `musica-libre` | **Artlist** o **Envato Elements** | Música sin problemas de derechos para los vídeos |
| `transcripcion-humana` | **Happy Scribe** | Cuando la transcripción tiene que ser perfecta (revisada por personas) |
| Luz (`data/ofertas.json`) | **Octopus Energy vía Awin** | Única comercializadora con programa de afiliados para webs que he encontrado |

| Programa | Alta | Comisión (según su web/fichas) | Requisitos y pagos |
|---|---|---|---|
| ElevenLabs | https://elevenlabs.io/affiliates (gestionado con PartnerStack) | 22 % durante 12 meses (11 % en plan Business) | Cuenta de ElevenLabs → Afiliados → PartnerStack. Pago mínimo 5 $; se libera tras 90 días de suscripción activa |
| Submagic | https://www.submagic.co/affiliate | 30 % recurrente | Revisión manual (hasta 72 h): piden web, métodos de promoción y público. Pago por PayPal, mínimo 50 $ |
| OpusClip | https://www.opus.pro/affiliate | 25 % recurrente el primer año | Solicitud de 1 minuto. Pago el día 15 por PayPal, mínimo 20 $. **Desactivan el enlace si no genera tráfico en 6 meses** |
| Happy Scribe | https://www.happyscribe.com/affiliate | Hasta 30 % (programa en beta) | Cookie de 60 días. Pago mensual por PayPal o transferencia |
| Artlist | https://artlist.io/lp/ambassador-program/ | Importe fijo por suscriptor (distinto en mensual y anual) | Formulario con revisión; pagos con Impact |
| Envato Elements | https://elements.envato.com/learn/affiliates (con Impact) | Hasta 60 $ por mensual / 120 $ por anual (solo clientes nuevos) | Cuenta en Impact obligatoria |
| Octopus Energy | Awin: https://ui.awin.com/merchant-profile/116547 | Hasta 31,50 € por alta efectiva | Cuenta de publisher en Awin y solicitud al anunciante. Cookie 30 días, último clic |

**No uses códigos de «invita a un amigo» en la web.** Octopus (OctoAmigos) y Gana Energía (Plan Amigo) tienen
planes de referidos para clientes; Octopus dice expresamente que limita las cuentas que usan el enlace como
forma de ganar dinero (en redes, por ejemplo). Para Gana Energía no he encontrado programa de afiliados para
webs: si te interesa, pregúntales por email si tienen uno.

**Recuerda la regla de la web** (decisión 69 de DECISIONS.md): una tarifa patrocinada se marca como tal y **nunca cambia de
puesto** en el comparador; la lista siempre va por precio. Díselo al anunciante si pregunta.

---

## Texto para los formularios

### En inglés (ElevenLabs, Submagic, OpusClip, Happy Scribe, Artlist, Envato)

**Website:** https://herramientaslibres.es

**Describe your website / audience:**
> Herramientas Libres is a free, Spanish-first website with browser-based tools for content creators: animated
> word-by-word video captions (for TikTok, Reels and Shorts) and audio-to-text transcription. Everything runs on
> the user's device with open-source AI, so there's no sign-up and no upload. Our audience is Spanish-speaking
> creators, podcasters, students and small businesses who make short videos or need transcripts.

**How will you promote us?**
> Contextual, clearly labelled recommendations on the result screen, shown only after a user finishes a task
> where your product is the natural next step (e.g. dubbing a video after captioning it, a human-reviewed
> transcript, royalty-free music for the video). Links carry rel="sponsored" and an "Affiliate link" label. We
> also publish tutorials and comparison pages in Spanish, and short videos on TikTok, Instagram and YouTube
> Shorts showing creator workflows. No paid search on your brand, no coupon sites, no spam.

**Monthly traffic:** *di la verdad: pon la cifra de GoatCounter del último mes o «new site, launched September 2026».*

### En español (Awin / Octopus Energy)

**Descripción de la web:**
> Herramientas Libres (herramientaslibres.es) es una web gratuita con herramientas para ahorrar en la factura de
> la luz: un comparador que usa el consumo real hora a hora del usuario (CSV de su distribuidora o Datadis,
> procesado en su navegador sin subirlo), el precio de la luz de hoy y de mañana con datos de Red Eléctrica,
> calculadoras de coste por electrodoméstico y hora, y un estudio anual de las horas más baratas. También
> tenemos un canal de Telegram con el precio de mañana cada tarde.

**Cómo promocionaremos al anunciante:**
> En el comparador, la tarifa del anunciante aparece en su puesto según el precio calculado con el consumo real
> del usuario, marcada como «Patrocinado», con un enlace a la contratación. Nunca se sube de puesto por pagar
> comisión. También podremos mencionarla en guías sobre coche eléctrico y tarifas con discriminación horaria
> cuando encaje. No usamos cupones, pujas por la marca ni emails masivos.

**Tipo de publisher:** Contenido / Comparador. **Promoción:** SEO, Telegram, redes sociales.
