# Hordalia Arena

Juego .io de 12 jugadores en el navegador. Cada jugador pelea por su memecoin y las victorias suman al ranking semanal de su comunidad.

## Qué hay en la carpeta

| Ruta | Qué es |
|---|---|
| `src/game.html` | El juego (cliente). Aquí se edita. |
| `shared/sim.js` | La simulación de la Arena. La usan el navegador (partidas de práctica) y el servidor (partidas online). |
| `server/server.js` | Servidor: salas de 12, relleno con bots, verificación de monedas en DexScreener y ranking semanal. |
| `build.py` | Junta `src/game.html` + `shared/sim.js` y genera `web/index.html` y `server/public/index.html`. |

Después de cambiar `src/game.html` o `shared/sim.js`, ejecuta `python3 build.py`.

## Probarlo en tu ordenador

Necesitas Node.js 18 o superior.

```
npm install
npm start
```

Abre http://localhost:8080 en dos pestañas y pulsa «Jugar Arena» en las dos: entraréis en la misma partida. Los huecos libres se rellenan con bots a los 8 segundos.

## Publicarlo en Render (gratis para empezar)

1. Sube esta carpeta a un repositorio de GitHub (sin `node_modules`).
2. En render.com: **New → Web Service** y elige el repositorio.
3. Configuración:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
4. Variables de entorno (opcionales):
   - `OFFICIAL_CA`: el contrato de tu moneda oficial cuando la lances. Activa la skin Zorro Eclipse y el +5% de daño para quien juegue con ella.
   - `LOBBY_WAIT`: milisegundos de espera antes de rellenar con bots (por defecto 8000).
5. Render te da una dirección tipo `https://hordalia.onrender.com`. El juego y el servidor viven en la misma dirección, así que no hay que configurar nada más.

Pon también tu contrato en `CONFIG.official.ca` (al principio del bloque de memecoins de `src/game.html`) para que el campamento muestre el botón «Jugar con $HORDA», y `CONFIG.shareUrl` con tu dirección para que el mensaje para X la incluya.

### Avisos de la versión gratuita de Render

- **Se duerme** tras 15 minutos sin visitas. La primera persona que entra espera unos 30-50 segundos a que cargue la página. Con el plan Starter (unos 7 $/mes) no se duerme.
- **El disco no es permanente**: el ranking (`server/data/ranking.json`) se borra en cada despliegue o reinicio. Para un ranking que dure, añade un disco persistente en Render (plan de pago) y apunta `DATA_DIR` a él, o pasa el ranking a una base de datos (Supabase).

## Si alojas la web en otro sitio (Vercel, Netlify…)

Sube `web/index.html` y en `src/game.html` pon `CONFIG.server = 'wss://tu-servidor.onrender.com'`, ejecuta `python3 build.py` y vuelve a subirlo.

## Seguridad y trampas

- El servidor decide todo lo que pasa en la partida. El navegador solo envía «hacia dónde me muevo», «esquivo» y «elijo mejora».
- El rango por market cap lo calcula el servidor consultando DexScreener. Lo que diga el navegador no cuenta.
- Solo puntúan en el ranking las partidas online con una moneda verificada. Las monedas en modo prueba y los bots no cuentan.
- Las monedas y gemas del jugador siguen guardándose en su navegador. Si un día vendes algo con dinero real, eso tendrá que pasar al servidor.
