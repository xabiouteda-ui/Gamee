#!/usr/bin/env python3
"""Genera las tres salidas desde src/game.html + shared/sim.js:
   hordalia.html (vista previa en Claude), web/index.html (web estática), server/public/index.html (servidor)."""
import os
R=os.path.dirname(os.path.abspath(__file__))
src=open(os.path.join(R,'src/game.html'),encoding='utf-8').read()
sim=open(os.path.join(R,'shared/sim.js'),encoding='utf-8').read()
assert src.count('<!--SIM-->')==1
page=src.replace('<!--SIM-->','<script>\n'+sim+'\n</script>')
open(os.path.join(R,'hordalia.html'),'w',encoding='utf-8').write(page)
head='<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="description" content="Arena .io gratis en el navegador: pelea por tu memecoin y sube a tu comunidad en el ranking.">\n</head>\n<body>\n'
full=head+page+'\n</body>\n</html>\n'
for p in ('web/index.html','server/public/index.html'):
    os.makedirs(os.path.join(R,os.path.dirname(p)),exist_ok=True)
    open(os.path.join(R,p),'w',encoding='utf-8').write(full)
print('build ok')
