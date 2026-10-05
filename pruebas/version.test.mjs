// La app detecta una publicación nueva: se recarga sola una vez y, si sigue viendo la antigua o hay algo a medias, avisa con un botón.
// Uso: node pruebas/version.test.mjs <carpeta construida>
import { spawn } from 'node:child_process'; import fs from 'node:fs';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], port = 8794, base = 'http://localhost:' + port, vf = dir + '/version.json', orig = fs.readFileSync(vf, 'utf8');
const srv = spawn('node', [new URL('./servidor_prueba.mjs', import.meta.url).pathname, dir, String(port)], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'OK    ' : 'FALLA ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
try {
  const p = await (await b.newContext()).newPage(); let loads = 0; p.on('load', () => loads++);
  await p.goto(base + '/'); await p.waitForTimeout(2600);
  ok('misma versión: ni recarga ni aviso', loads === 1 && !(await p.$('#upd-bar')));
  fs.writeFileSync(vf, JSON.stringify({ v: 'nueva0000001' }));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(4000);
  ok('versión nueva publicada: se recarga sola una vez', loads === 2, 'cargas: ' + loads);
  ok('si tras recargar sigue la antigua, no entra en bucle y enseña el botón', await p.isVisible('#upd-go') && loads === 2, 'cargas: ' + loads);
  fs.writeFileSync(vf, JSON.stringify({ v: 'nueva0000002' }));
  await p.click('#v-need a'); await p.waitForTimeout(200); await p.fill('#p-name', 'Escribiendo'); await p.evaluate(() => { document.querySelector('#upd-bar').remove(); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(2500);
  ok('con el formulario a medias no recarga: avisa', loads === 2 && await p.isVisible('#upd-go') && (await p.inputValue('#p-name')) === 'Escribiendo', 'cargas: ' + loads);
  await p.click('#upd-go'); await p.waitForTimeout(2500); ok('el botón Actualizar recarga', loads === 3, 'cargas: ' + loads);
} catch (e) { console.log('ERROR ' + e.message.split('\n')[0]); fails++; } finally { fs.writeFileSync(vf, orig); await b.close(); srv.kill(); }
console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
