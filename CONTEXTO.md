# Hordalia: contexto completo del proyecto

Documento para continuar el proyecto en una conversación nueva. Léelo entero antes de empezar.

## Quién soy y cómo quiero trabajar

- Hablo español. Respóndeme en español.
- Tengo trabajo, pero mi objetivo es vivir de ingresos por internet.
- Quiero calidad de «programador pro»: buenas animaciones, que el juego enganche y la monetización siempre en mente.
- Prefiero que hagas las cosas tú (código, subidas a GitHub, despliegues) y me pidas solo lo que solo puedo hacer yo, como crear cuentas o iniciar sesión.

## Qué es Hordalia

Un juego de navegador inspirado en PokéSurvivor y en los survivor tipo Vampire Survivors, pero con criaturas propias (nada de Pokémon, para poder monetizar sin problemas de marca).

- **Arena online (modo principal):** partidas tipo .io de 12 jugadores. Gana el último en pie. Hay 20 s de tregua sin daño entre jugadores, monstruos para farmear experiencia y una zona que se cierra. Las mejoras se eligen con cartas que no pausan la partida (teclas 1-2-3). Esquiva con Espacio o con botón en el móvil. Si faltan jugadores, se rellena con bots. Las partidas duran de 2 a 3 minutos.
- **Modo horda (solitario):** práctica contra oleadas, con jefe (Rey Gelatina), élites que sueltan cofres con ruleta de premios y combos. No suma al ranking.
- **Campamento (menú):** escena interactiva de noche con hoguera, tienda, árbol con luces, muñeco de paja (da monedas muy lentamente, máximo 40 al día), mina de monedas mejorable en 5 niveles (con monedas o gemas), luciérnagas que dan monedas y slimes y mascotas que reaccionan al tocarlos.
- **Gacha:** armas por rareza (Común, Raro, Épico, Legendario y Mítico), más mascotas. El Mítico es la Corona del Eclipse. Hay garantía de Legendario a las 40 tiradas y de Mítico a las 90, al menos un Raro en cada ×10 y estrellas por copias repetidas. **En la Arena las armas solo cambian el estilo, no el daño**, para que no sea pagar para ganar.
- **Mascotas:** Chispa, Musgo y Nebulón. Acompañan y pegan poco.
- **Misiones diarias** que dan gemas, **sonido y música** generados en el propio código, iluminación dinámica y muchas animaciones.

## Memecoins (la idea principal de negocio)

- El jugador pega el **contrato de cualquier memecoin**. Su personaje lleva el logo y el ticker de esa moneda.
- El **market cap se lee en directo de DexScreener** y da **rangos**: Bronce desde 10k, Plata desde 60k, Oro desde 100k y Diamante desde 1M. Las ventajas son casi solo cosméticas (aura, chispas, monedas en órbita, halo) y como mucho +10% de monedas, para que las monedas pequeñas también puedan ganar.
- **Ranking semanal de comunidades:** cuenta qué moneda tiene más victorias en la Arena esta semana. Incluye un botón para copiar un mensaje y compartirlo en X.
- **Mi moneda oficial ($HORDA, nombre provisional):** da la skin exclusiva «Zorro Eclipse» y +5% de daño. Se activa poniendo su contrato en la variable de entorno `OFFICIAL_CA` del servidor y en `CONFIG.official.ca` de `src/game.html`.
- Pienso lanzar mi memecoin en pump.fun y promocionarla con una cuenta de X.
- Riesgos que ya hablamos: el token **no** debe comprar tiradas del gacha ni ventajas, porque gacha más token con valor real se parece a las apuestas y es lo más arriesgado legalmente en la UE. Además, si el token cae, salpica la reputación del juego.

## Monetización montada (en modo prueba, aún no cobra nada)

- **Anuncios con recompensa** (ahora simulados): tirada gratis cada 5 min, revivir y duplicar monedas. La idea es usar el SDK de CrazyGames o Poki.
- **Tienda de gemas** de prueba: pack de inicio a 1,99 € y packs de 0,99 € a 19,99 €. Pase de temporada marcado como «próximamente».

## Cómo está hecho el código

Repositorio **xabiouteda-ui/Gamee**, rama **hordalia-arena**. La rama main es otro proyecto: no la toques.

| Ruta | Qué es |
|---|---|
| `src/game.html` | El juego entero (HTML, CSS y JS en un archivo, dibujado en canvas). Aquí se edita. |
| `shared/sim.js` | La simulación de la Arena, sin DOM. La usan el navegador (partidas de práctica con bots) y el servidor (partidas online). Todo lo visual sale como eventos. |
| `server/server.js` | Servidor Node con WebSockets (paquete `ws`): salas de 12, espera de 8 s y luego relleno con bots, simulación autoritativa a 30 Hz, snapshots a 15 Hz filtrados por cercanía, verificación de monedas en DexScreener y ranking semanal en `server/data/ranking.json` (rutas `/ranking` y `/health`). |
| `build.py` | Junta `src/game.html` y `shared/sim.js` y genera `web/index.html` y `server/public/index.html`. **Ejecútalo después de cada cambio.** |
| `render.yaml` | Configuración para desplegar en Render (plan gratuito, rama hordalia-arena). |
| `README.md` | Instrucciones de despliegue y avisos. |

Detalles importantes:

- El navegador solo envía «hacia dónde me muevo», «esquivo» y «elijo mejora». El servidor decide todo lo demás.
- Si no hay servidor (por ejemplo, abriendo el HTML suelto), el juego hace una partida de práctica con bots usando la misma simulación.
- Las monedas y gemas del jugador se guardan en su navegador (localStorage). Si algún día se vende algo con dinero real, eso tiene que pasar al servidor.
- Variables de entorno del servidor: `PORT`, `LOBBY_WAIT` (ms), `OFFICIAL_CA`, `DATA_DIR`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SIM_SPEED` (solo para pruebas).
- Ranking: si están `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, se guarda en la tabla `ranking` de Supabase (una fila por semana, SQL en `server/sql/ranking.sql`); si no, en `server/data/ranking.json`. Al recibir SIGTERM guarda lo pendiente.
- Lo probé en local con 3 navegadores a la vez: entran en la misma partida, se ven entre ellos, y la verificación de BONK y el ranking funcionan.

## Estado actual y siguiente paso

- **Publicado en Render:** https://hordalia-arena.onrender.com (Blueprint «hordalia», servicio hordalia-arena, plan gratuito, se despliega solo con cada push a hordalia-arena). `/health` y `/ranking` responden y dos jugadores entran en la misma sala. `CONFIG.shareUrl` ya apunta ahí.
- **Ranking en Supabase:** código hecho y probado. Pendiente: crear el proyecto en Supabase, ejecutar `server/sql/ranking.sql` y poner `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` en Render → Environment (la clave la pega el usuario).

Aviso del plan gratuito de Render: se duerme tras 15 min sin visitas (la primera carga tarda 30-50 s). El plan de pago (unos 7 $/mes) lo evita.

## Ideas para después

- Algo de protección contra trampas.
- Predecir tu propio movimiento en el navegador si se nota retraso online.
- Segunda zona (desierto o hielo) con enemigos y jefe nuevos.
- Skins cosméticas de pago para el zorrito.
- Integrar de verdad los anuncios de CrazyGames o Poki y publicar allí.
- Clips de gacha y de partidas para TikTok y Shorts (ya hago vídeos cortos).
