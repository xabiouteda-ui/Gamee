// Rellena los huecos .ad-slot con bloques de AdSense si están activados en config.js.
// Con los anuncios desactivados no se carga ningún script de terceros.
(function () {
  const cfg = window.SITE_CONFIG || {};
  const client = (cfg.adsenseClient || "").trim();
  if (!cfg.adsEnabled || !/^ca-pub-\d+$/.test(client)) return;

  const slots = document.querySelectorAll(".ad-slot[data-slot]");
  slots.forEach((el) => {
    const id = (cfg.slots || {})[el.dataset.slot];
    if (!id) return;
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    // Tamaño fijo por hueco (lo pone style.css): ancho adaptable y alto exacto, así el anuncio no mueve la página.
    ins.dataset.adClient = client;
    ins.dataset.adSlot = id;
    el.appendChild(ins);
    el.classList.add("ad-on");
  });
  // Sin bloques configurados se carga igualmente el script: así funcionan los "anuncios automáticos" de AdSense.
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(client);
  s.onload = () => {
    document.querySelectorAll(".ad-slot.ad-on ins.adsbygoogle").forEach(() => {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* bloqueador de anuncios */ }
    });
  };
  document.head.appendChild(s);
})();
