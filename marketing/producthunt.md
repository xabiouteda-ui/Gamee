# Product Hunt y Show HN (en inglés)

Lanza **las herramientas de subtítulos y transcripción** (la luz solo interesa en España). Página de destino:
https://herramientaslibres.es/en/animated-captions/ . Imágenes en [`assets/`](assets/).

## Product Hunt

- **Launch day:** martes o miércoles; publica a las 00:01 hora del Pacífico (09:01 en España).
- **Name:** Herramientas Libres
- **Tagline (≤ 60):** `Animated captions & transcription that never upload your video`
- **Topics:** Video · Artificial Intelligence · Privacy · Free
- **Pricing:** Free
- **Gallery:** `en-captions.png`, `captura-subtitulos.png`, `captura-transcripcion.png`, `portada-1200x630.jpg`
  (mejor aún un GIF/vídeo de 20 s del guion 1 de [shorts.md](shorts.md) en inglés).

**Description (≤ 260):**
> Free word-by-word animated captions (karaoke, pop, neon…) and Whisper transcription that run 100% in your
> browser. Your video never leaves your device, so there's no watermark, no sign-up and no monthly limits.

**First comment (maker):**
> Hi Product Hunt 👋
>
> I kept paying caption apps a monthly fee mostly to remove a watermark, while the actual AI (Whisper) is open
> source and now runs fine inside a browser. So I built this:
>
> • Drop a video → word-level captions are generated **on your device** (WebGPU/WASM, no upload).
> • Pick a style (karaoke, word-by-word, box, neon, comic…), highlight keywords, add emojis, keep text inside the
>   TikTok/Reels/Shorts safe zone, convert horizontal video to 9:16.
> • Export an MP4 up to 1080p or an SRT. No watermark (there's a tiny optional "Made with" credit you can untick).
> • There's also plain audio-to-text (TXT/SRT/VTT) for voice notes, lectures and interviews.
>
> It's funded by ads on the page, not on your videos. Because processing happens on your hardware, older phones
> are slower with long videos — a laptop is best.
>
> I'd love feedback on caption styles you'd like next, and on anything that breaks on your device.

## Show HN

**Title:** `Show HN: Animated video captions with Whisper, fully client-side`
**URL:** https://herramientaslibres.es/en/animated-captions/
**Text (first comment):**
> This is a free captioning tool that runs Whisper (via Transformers.js) and renders word-level animated captions
> in the browser, then encodes the MP4 with WebCodecs. No server sees the video or the audio; the page is static
> hosting on GitHub Pages.
>
> Some details that may be interesting:
> - Word timestamps come from a timestamped Whisper model (WebGPU when available, WASM otherwise); the editor
>   re-times words when you fix a line.
> - Captions are drawn on a canvas per frame and muxed with Mediabunny; up to 1080p, and 50/60 fps sources are
>   exported at 30 fps.
> - If WebCodecs isn't available (some older iOS), it tells you and offers the SRT instead.
> - No accounts and no analytics cookies.
>
> Known limits: long videos on low-end phones are slow; first run downloads the model (then cached).
> Happy to answer questions about the pipeline.

*(Antes de publicar, confirma en el código que los detalles técnicos siguen siendo ciertos: `assets/js/worker.js`
y `assets/js/captions/`. Si algo cambió, quita esa línea.)*
