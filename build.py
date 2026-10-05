#!/usr/bin/env python3
"""Genera la versión web (index.html) a partir de la fuente de la versión de Claude (src/elitepro.html)."""
import sys, os, json, html, hashlib, pathlib
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
# Cuenta en la nube: solo se incluye si src/nube.json tiene la dirección del servidor (o se pasa por ELITEPRO_NUBE_URL)
cfg = json.loads((snip / 'nube.json').read_text(encoding='utf8')) if (snip / 'nube.json').exists() else {}
cfg['url'] = os.environ.get('ELITEPRO_NUBE_URL', cfg.get('url', ''))
core = (snip / 'snip_cloud_core.js').read_text(encoding='utf8') if cfg['url'] else ''
if 'ELITEPRO_NUBE_URL' not in os.environ and cfg['url'] and not (cfg.get('responsable') and cfg.get('contacto')):
    sys.exit('Falta "responsable" o "contacto" en src/nube.json: sin ellos la política de privacidad no vale.')
jsesc = lambda v: json.dumps(v, ensure_ascii=False)[1:-1].replace('</', '<\\/')  # para textos que van dentro de un script
def fill(t, esc):
    for k, v in (('__CLOUD_URL__', cfg['url']), ('__CLOUD_KID__', cfg.get('kid', '')), ('__RESPONSABLE__', cfg.get('responsable', '')), ('__CONTACTO__', cfg.get('contacto', '')), ('__ACTUALIZADA__', cfg.get('actualizada', ''))):
        t = t.replace(k, esc(v))
    return t
if cfg['url']:
    card = (snip / 'snip_cloud_card.html').read_text(encoding='utf8') + card
    js = js + core + fill((snip / 'snip_cloud_js.js').read_text(encoding='utf8'), jsesc)
rep('      <div class="card">\n        <div class="eyebrow">Empezar de cero</div>', card + '      <div class="card">\n        <div class="eyebrow">Empezar de cero</div>')
js = js + (snip / 'snip_update_js.js').read_text(encoding='utf8')
rep('/* ---------- Empezar de cero ---------- */', js + '/* ---------- Empezar de cero ---------- */')
rep('goLocal("Estás sin sesión: lo que apuntes se guarda solo en este navegador.")', 'goLocal("Lo que apuntes se guarda solo en este navegador. Descarga una copia de vez en cuando desde Perfil.")')
rep('"Leer fotos solo funciona en la app publicada, abierta dentro de Claude. Aquí apúntalo a mano o elige de la lista."', '"Esta versión no lee fotos. Apúntalo a mano o elige de la lista."')
rep('placeholder="73,0"', 'placeholder="70,0"'); rep('placeholder="35"', 'placeholder="30"')
i = s.index('<div class="app">')
doc = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       + fav + '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' + s[:i] + '</head>\n<body>\n' + s[i:] + '\n</body>\n</html>\n')
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / 'index.html'
# Huella de esta publicación: va dentro de la página y en version.json, para que la app sepa cuándo hay una más nueva
build = hashlib.sha1(doc.encode('utf8')).hexdigest()[:12]
doc = doc.replace('__BUILD__', build)
out.write_text(doc, encoding='utf8')
(out.parent / 'version.json').write_text(json.dumps({'v': build}) + '\n', encoding='utf8')
print('ok', out, len(doc))
if cfg['url']:
    for name in ('panel.html', 'privacidad.html'):
        t = fill((snip / name).read_text(encoding='utf8').replace('/*__CORE__*/', core), jsesc if name == 'panel.html' else html.escape)
        (out.parent / name).write_text(t.replace('<!--FAVICON-->', fav), encoding='utf8')
        print('ok', out.parent / name, len(t))
