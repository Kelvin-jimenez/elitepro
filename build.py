#!/usr/bin/env python3
"""Genera la versión web (index.html) a partir de la fuente de la versión de Claude (src/elitepro.html)."""
import sys, pathlib
here = pathlib.Path(__file__).resolve().parent
src = (here / 'src' / 'elitepro.html') if (here / 'src').exists() else (here / 'plato-y-pista.html')
snip = (here / 'src') if (here / 'src').exists() else here
s = src.read_text(encoding='utf8')
def rep(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:70])
    s = s.replace(a, b)
card = (snip / 'snip_backup_card.html').read_text(encoding='utf8')
js = (snip / 'snip_backup_js.js').read_text(encoding='utf8')
fav = (snip / 'snip_favicon.html').read_text(encoding='utf8')
rep('      <div class="card">\n        <div class="eyebrow">Empezar de cero</div>', card + '      <div class="card">\n        <div class="eyebrow">Empezar de cero</div>')
rep('/* ---------- Empezar de cero ---------- */', js + '/* ---------- Empezar de cero ---------- */')
rep('goLocal("Estás sin sesión: lo que apuntes se guarda solo en este navegador.")', 'goLocal("Lo que apuntes se guarda solo en este navegador. Descarga una copia de vez en cuando desde Perfil.")')
rep('"Leer fotos solo funciona en la app publicada, abierta dentro de Claude. Aquí apúntalo a mano o elige de la lista."', '"Esta versión no lee fotos. Apúntalo a mano o elige de la lista."')
rep('placeholder="73,0"', 'placeholder="70,0"'); rep('placeholder="35"', 'placeholder="30"')
i = s.index('<div class="app">')
doc = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       + fav + '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' + s[:i] + '</head>\n<body>\n' + s[i:] + '\n</body>\n</html>\n')
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / 'index.html'
out.write_text(doc, encoding='utf8')
print('ok', out, len(doc))
