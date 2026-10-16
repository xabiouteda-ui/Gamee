# Roadmap · herramientaslibres.es

Revisado el 12/10/2026. Se actualiza al final de cada sesión de trabajo.

## 1. Dónde estamos

| Indicador | Valor (12/10/2026) | Fuente |
|---|---|---|
| Páginas publicadas | 73 (70 en el sitemap) | build |
| Páginas indexadas en Google | 34 · 34 «descubiertas, sin indexar» (casi todas del ITP por comunidad, publicadas el 5/10) | Search Console |
| Clics desde Google | 3 en las últimas semanas | Search Console |
| Visitas | ~2 a la semana | Cloudflare Web Analytics |
| AdSense | Rechazado el 16/10 por «contenido de poco valor»; corregido el mismo día (guías firmadas, fuera de Google lo repetido). Volver a pedir revisión hacia el 20/11 | AdSense |
| Rendimiento (Lighthouse, portada) | Rendimiento 90 · Accesibilidad 100 · Buenas prácticas 96 · SEO 100 | Lighthouse local |
| Redes | Página de Facebook (0 seguidores, ~250 reproducciones por reel) · TikTok con alcance casi nulo | Meta / TikTok Studio |

**Diagnóstico.** La parte técnica está bien resuelta (rápida, accesible, datos estructurados, sitemap, IndexNow). El
cuello de botella es la **demanda**: las herramientas actuales atacan búsquedas con poco volumen o mucha competencia, el
dominio es nuevo (Google rastrea poco) y casi no hay enlaces externos. Los vídeos no traen visitas todavía.

## 2. Objetivo y métricas

**Objetivo a 90 días (hasta el 10/01/2027):** 1.000 visitas al mes desde Google y AdSense aprobado y mostrando anuncios.

| Métrica | Hoy | 31/10 | 30/11 | 10/01 |
|---|---|---|---|---|
| Páginas indexadas | 34 | 60 | 90 | 120 |
| Clics/mes desde Google | ~3 | 50 | 300 | 1.000 |
| Dominios que enlazan a la web | ~0 | 3 | 8 | 15 |
| AdSense | En revisión | Aprobado | — | RPM medido |

## 3. Principios para elegir qué hacer

1. **Búsquedas grandes donde una herramienta gana a un artículo** (calculadoras con datos oficiales).
2. **Fechas que traen picos**: nómina de enero, calendario laboral (nov-dic), Renta (abr-jun), luz en invierno.
3. **Datos oficiales y comprobables** (BOE, AEAT, Seguridad Social, REE). Nada inventado: si un dato no se puede
   verificar, no se publica.
4. **Cada página nueva con contenido propio** (cálculos, tablas, ejemplos), nunca plantillas vacías: es lo que pide
   AdSense y lo que premia Google.

## 4. Plan por fases

### Fase 1 · Semana del 12/10 — Herramienta estrella de nómina ✅ (12/10)
- [x] Seguridad básica, enlazado interno desde la portada y animaciones.
- [x] **Calculadora de sueldo neto 2026** con el algoritmo oficial de retenciones de la AEAT (versión del 10/09/2026)
      y las cotizaciones de 2026 (incluida la cotización de solidaridad). 12 o 14 pagas, hijos, edad, discapacidad,
      contrato temporal, Ceuta/Melilla/La Palma y coste para la empresa. 26 pruebas + contraste con una
      implementación independiente en 1.896 casos.
- [x] **29 páginas «X euros brutos en netos»** (de 15.000 € a 100.000 €) con nómina, casos familiares y coste empresa.
- [x] Guías: **salario mínimo 2026 en neto** (la retención de 37,36 €/mes coincide con la que publica la prensa) y
      **tabla de retenciones IRPF 2026**.
- [x] Revisión de calidad para AdSense: ITP por comunidad con comparativa propia frente a las vecinas y la moto.
- [x] Portada: dato de la luz del día (se rehace cada tarde), «Lo más buscado» y la nueva sección en el menú.
- [x] Vídeo y textos del sueldo neto (`marketing/sueldo.md`), pendientes de tu OK para publicar.
- [x] Pruebas automáticas al día (las de anuncios asumían AdSense apagado) y redirección a https mientras no se active
      «Enforce HTTPS» en GitHub Pages.

### Fase 2 · 13/10 – 31/10 — Indexación, primeros enlaces y calidad para AdSense
- [x] 16/10: rechazo de AdSense por «contenido de poco valor». Sección de guías firmadas (4 artículos), «Sobre nosotros»
      en primera persona y noindex para el inglés, 19 sueldos poco buscados y 3 páginas de subtítulos repetidas.
- [ ] Una guía nueva por semana hasta pedir la revisión (próximas: PVPC o mercado libre con datos reales, paro, finiquito).
- [ ] Pedir indexación de las guías en Search Console y volver a pedir revisión de AdSense hacia el 20/11.
- [ ] **Tú:** GitHub → Settings → Pages → marcar «Enforce HTTPS» (hoy la web también responde por http).
- [ ] Pedir indexación manual en Search Console de las 10 páginas más importantes (máx. ~10 al día).
- [ ] Altas en directorios y foros de la carpeta `marketing/` (las que piden datos personales, las haces tú).
- [ ] 5 contactos a medios/blogs de ahorro y empleo con un dato propio (estudio de la luz 2026, sueldo neto).
- [ ] Calentar TikTok desde el móvil (uso normal unos minutos al día) y resubir los vídeos v2 desde la app.
- [ ] Facebook: 2 reels por semana, uno de luz y uno de herramienta.

### Fase 3 · Noviembre — Calendario laboral 2027
- [ ] Cuando el BOE publique las fiestas nacionales de 2027 (suele ser a finales de octubre): **calendario laboral
      2027** por comunidad, con puentes y festivos. Ya hay comunidades con el suyo publicado (Murcia, Navarra,
      Extremadura, País Vasco).
- [ ] Página «nómina de enero 2027: qué cambia» en cuanto haya SMI y tablas nuevas.
- [ ] Widget del sueldo neto para que blogs lo inserten (enlaza de vuelta).

### Fase 4 · Diciembre – enero — Pico de la nómina y la luz de invierno
- [ ] Actualizar la calculadora al algoritmo AEAT de 2027 el mismo día que se publique.
- [ ] Campaña de vídeos «¿cuánto cobrarás en enero?».
- [ ] Revisión de ingresos: RPM de AdSense por sección y decisión sobre Pro/afiliados.

### Fase 5 · Febrero – junio 2027 — Renta
- [ ] Guías y calculadoras de la campaña de la Renta 2026 (deducciones autonómicas, ¿me sale a pagar?).

## 5. Backlog (ordenado por impacto / esfuerzo)

| Idea | Impacto | Esfuerzo | Nota |
|---|---|---|---|
| Calculadora de sueldo neto | Muy alto | Medio | Fase 1 |
| Brutos → netos por salario | Alto | Bajo | Fase 1, reutiliza el cálculo |
| Calendario laboral 2027 | Muy alto (estacional) | Medio | Fase 3, depende del BOE |
| Calculadora de finiquito | Alto | Alto | Riesgo legal: solo con convenio general y avisos claros |
| Calculadora de paro (prestación) | Alto | Medio | Topes 2026 verificados (560–1.575 €); falta confirmar en fuente oficial el descuento de Seguridad Social (4,70 % o el 65 % de esa cuota) antes de publicar |
| Días hábiles entre fechas | Medio | Bajo | Útil para plazos administrativos |
| Precio de la luz en la portada (dato del día) | Medio | Bajo | Más frescura para Google |
| Versión inglesa del resto de herramientas | Bajo | Medio | Poca demanda frente al español |

## 6. Riesgos

- **Errores en cálculos fiscales**: cada calculadora lleva pruebas con casos comprobados a mano y cita su fuente
  oficial; ante la duda se muestra un aviso, no un número.
- **AdSense rechaza por contenido de poco valor**: nada de páginas plantilla sin contenido propio.
- **Dependencia de Google**: Telegram y redes como segundo canal; el widget de la luz y el de la nómina traen
  enlaces.

## 7. Cosas que solo puedes hacer tú

- Aprobar cada publicación en redes (o subir desde el móvil).
- Altas que piden tus datos personales o una contraseña (directorios, Bing Webmaster, datos.gob.es).
- Crear el bot de Telegram (BotFather) y pegar el token en GitHub.
- Revisar el correo de AdSense y aceptar el mensaje de consentimiento (CMP) cuando lo pida.
