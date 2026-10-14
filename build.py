#!/usr/bin/env python3
"""Genera las tres salidas desde src/game.html + shared/sim.js:
   hordalia.html (vista previa en Claude), web/index.html (web estática), server/public/index.html (servidor)."""
import os,shutil
R=os.path.dirname(os.path.abspath(__file__))
src=open(os.path.join(R,'src/game.html'),encoding='utf-8').read()
sim=open(os.path.join(R,'shared/sim.js'),encoding='utf-8').read()
assert src.count('<!--SIM-->')==1
page=src.replace('<!--SIM-->','<script>\n'+sim+'\n</script>')
open(os.path.join(R,'hordalia.html'),'w',encoding='utf-8').write(page)
# tarjeta para X/Telegram/Discord; el servidor cambia el bloque OG por uno de la moneda cuando el enlace lleva ?ca=
URL='https://hordalia-arena.onrender.com'
OG=('<!--OG-->\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Hordalia">\n'
    '<meta property="og:title" content="Hordalia: pelea por tu memecoin">\n'
    '<meta property="og:description" content="Arena .io gratis de 12 jugadores. Gana partidas y sube a tu comunidad en el ranking semanal.">\n'
    '<meta property="og:image" content="'+URL+'/og.png">\n<meta property="og:url" content="'+URL+'">\n'
    '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="'+URL+'/og.png">\n<!--/OG-->\n')
head='<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="description" content="Arena .io gratis en el navegador: pelea por tu memecoin y sube a tu comunidad en el ranking.">\n'+OG+'</head>\n<body>\n'
full=head+page+'\n</body>\n</html>\n'
for p in ('web/index.html','server/public/index.html'):
    os.makedirs(os.path.join(R,os.path.dirname(p)),exist_ok=True)
    open(os.path.join(R,p),'w',encoding='utf-8').write(full)
    shutil.copyfile(os.path.join(R,'assets/og.png'),os.path.join(R,os.path.dirname(p),'og.png'))
print('build ok')
