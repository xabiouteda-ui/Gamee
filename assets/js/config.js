// Configuración de anuncios (Google AdSense).
//
// Para activar los anuncios:
//   1. Pon tu ID de editor en `adsenseClient` (empieza por "ca-pub-").
//   2. Crea bloques de anuncios en AdSense y copia su "data-ad-slot" en `slots`.
//      Si dejas un hueco vacío, en ese hueco no se muestra nada.
//   3. Cambia `adsEnabled` a true, haz commit y push.
// El build genera automáticamente /ads.txt con tu ID.
window.SITE_CONFIG = {
  // Dirección del intermediario de «¿Qué cocino con lo que tengo?» (Cloudflare Worker). Vacía = herramienta oculta.
  neveraApi: "https://nevera-recetas.herramientaslibres.workers.dev/",
  adsEnabled: true,
  adsenseClient: "ca-pub-5682080498285633", // p. ej. "ca-pub-1234567890123456"
  slots: {
    top: "",      // debajo de la cabecera
    result: "",   // junto a la herramienta, visible mientras se transcribe
    content: "",  // en mitad del texto de la página
    bottom: ""    // antes del pie de página
  }
};
