// App instalable: manifiesto e iconos válidos, service worker activo, funciona sin conexión y el aviso de cuenta en Hoy.
// Uso: node pruebas/pwa.test.mjs <carpeta construida con ELITEPRO_NUBE_URL=/api>
import { spawn } from 'node:child_process';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], port = 8795, base = 'http://localhost:' + port;
const srv = spawn('node', [new URL('./servidor_prueba.mjs', import.meta.url).pathname, dir, String(port)], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch(); const errs = []; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'OK    ' : 'FALLA ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
try {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } }), p = await ctx.newPage(); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto(base + '/'); await p.waitForTimeout(600);
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); const m = await (await fetch(l.href)).json(); const icons = []; for (const i of m.icons) { const r = await fetch(new URL(i.src, l.href)); const bmp = await createImageBitmap(await r.blob()); icons.push(i.sizes + ':' + bmp.width + 'x' + bmp.height + ':' + i.purpose); } const a = document.querySelector('link[rel="apple-touch-icon"]'); const ab = await createImageBitmap(await (await fetch(a.href)).blob()); return { name: m.name, display: m.display, start: m.start_url, icons, apple: ab.width, theme: document.querySelector('meta[name="theme-color"]').content }; });
  ok('manifiesto: nombre, pantalla completa e inicio', man.name === 'Elitepro' && man.display === 'standalone' && man.start === './', JSON.stringify(man));
  ok('iconos del tamaño que declaran (192, 512 y adaptable) e icono de iPhone de 180', man.icons.join() === '192x192:192x192:any,512x512:512x512:any,512x512:512x512:maskable' && man.apple === 180, JSON.stringify(man));
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: new URL(r.scope).pathname, state: r.active && r.active.state }; });
  ok('service worker registrado y activo', sw.scope === '/' && /activ/.test(sw.state), JSON.stringify(sw));
  await p.reload(); await p.waitForTimeout(800);
  ok('la página queda bajo el service worker', await p.evaluate(() => !!navigator.serviceWorker.controller));
  // perfil y un dato
  await p.click('#v-need a'); await p.waitForTimeout(200); await p.fill('#p-name', 'Marco'); await p.fill('#p-age', '35'); await p.fill('#p-height', '167'); await p.fill('#p-weight', '73'); await p.click('#p-form button[type=submit]'); await p.waitForTimeout(500);
  await p.evaluate(() => { location.hash = '#datos'; }); await p.waitForTimeout(300);
  ok('Perfil: tarjeta para instalar con instrucciones', await p.isVisible('#pwa-card') && /pantalla de inicio/.test(await p.textContent('#pwa-body')));
  await p.evaluate(() => { location.hash = '#hoy'; }); await p.waitForTimeout(300);
  ok('Hoy: aviso para crear cuenta, con los dos botones', await p.isVisible('#cl-cta') && await p.isVisible('#cl-cta [data-cl="register"]') && await p.isVisible('#cl-cta [data-cl="login"]'));
  await p.click('#cl-cta [data-cl="register"]'); await p.waitForTimeout(300); ok('el botón abre «Crear cuenta»', await p.evaluate(() => document.querySelector('#sh-cloud').open) && (await p.textContent('#sh-cloud-t')) === 'Crear cuenta'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#cl-cta-x'); await p.waitForTimeout(150); await p.reload(); await p.waitForTimeout(800);
  ok('si se cierra el aviso, no vuelve a salir', !(await p.isVisible('#cl-cta')));
  // sin conexión
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(1200);
  ok('sin conexión: la app abre y enseña los datos', /Marco/.test(await p.textContent('#d-nav')) && await p.isVisible('#d-label .ring-svg'), (await p.textContent('body')).slice(0, 80));
  await p.click('#peso-card [data-sheet="peso"]'); await p.waitForTimeout(200); await p.fill('#w-val', '72,4'); await p.click('#w-form button[type=submit]'); await p.waitForTimeout(400);
  ok('sin conexión: se puede apuntar', /72,4/.test(await p.textContent('#d-peso')));
  await ctx.setOffline(false); await p.reload(); await p.waitForTimeout(1000);
  ok('al volver la conexión sigue lo apuntado', /72,4/.test(await p.textContent('#d-peso')));
  const pg = await ctx.newPage(); const r = await pg.goto(base + '/privacidad.html'); ok('las demás páginas siguen abriendo con el service worker', r.ok() && /Política de privacidad/.test(await pg.textContent('h1')));
  const cached = await p.evaluate(async () => (await (await caches.open('elitepro-v1')).keys()).map(k => new URL(k.url).pathname));
  ok('el panel del entrenador y version.json no se guardan sin conexión', !cached.some(k => /panel|version/.test(k)), cached.join());
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 2).join(' | ')); fails++; } finally { await b.close(); srv.kill(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
