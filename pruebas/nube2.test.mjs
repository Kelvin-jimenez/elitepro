// Casos límite de la cuenta en la nube (los que encontró la revisión independiente).
// Uso: node pruebas/nube2.test.mjs <carpeta construida con ELITEPRO_NUBE_URL=/api> [carpeta construida con una huella de llave equivocada]
import { spawn } from 'node:child_process';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], pinned = process.argv[3], port = 8793, base = 'http://localhost:' + port;
const srv = spawn('node', [new URL('./servidor_prueba.mjs', import.meta.url).pathname, dir, String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch(); const errs = []; let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? 'OK    ' : 'FALLA ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
const mk = async () => { const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); return p; };
const T = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
const get = async u => (await fetch(base + u)).text(), dump = async () => JSON.parse(await get('/__dump'));
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
const settle = async (p, ms = 3600) => { await p.waitForTimeout(ms); await p.waitForFunction(() => !/Sincronizando/.test((document.querySelector('#cl-chip') || {}).textContent || ''), null, { timeout: 20000 }); };
const syncNow = async p => { await go(p, '#datos'); await p.click('[data-cl="sync"]'); await settle(p, 900); };
const closed = p => p.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 });
const profile = async (p, name, w, cond) => { await p.goto(base + '/'); await p.waitForTimeout(400); await p.click('#v-need a'); await p.waitForTimeout(200); await p.fill('#p-name', name); await p.fill('#p-age', '35'); await p.fill('#p-height', '167'); await p.fill('#p-weight', String(w)); await p.selectOption('#p-plan', 'dia'); if (cond) await p.selectOption('#h-cond', cond); await p.click('#p-form button[type=submit]'); await p.waitForTimeout(400); };
const addMeal = async (p, name, g) => { await go(p, '#hoy'); await p.click('#nut-card [data-sheet="meal"]'); await p.waitForTimeout(200); await p.click('#f-manual'); await p.fill('#f-name', name); await p.fill('#f-g', String(g)); await p.waitForTimeout(100); await p.click('#f-submit'); await p.waitForTimeout(300); };
const weigh = async (p, w) => { await go(p, '#hoy'); await p.click('#peso-card [data-sheet="peso"]'); await p.waitForTimeout(200); await p.fill('#w-val', w); await p.click('#w-form button[type=submit]'); await p.waitForTimeout(300); };
const login = async (p, mail, pass, from = '#cloud-card [data-cl="login"]') => { await p.click(from); await p.waitForTimeout(200); await p.fill('#cl-email', mail); await p.fill('#cl-pass', pass); await p.click('#cl-go'); await closed(p); await settle(p, 700); };
const local = p => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('platoypista:v1:u:')))));
const meals = o => Object.values(o.days).reduce((n, x) => n + x.meals.length, 0), wts = o => Object.values(o.days).map(x => x.weight).filter(Boolean).join();
try {
  const C = await mk(); await C.goto(base + '/panel.html'); await C.waitForSelector('#v-setup:not([hidden])'); await C.fill('#s-code', await get('/__setup')); await C.fill('#s-pass', 'entrenador-clave-1'); await C.fill('#s-pass2', 'entrenador-clave-1'); await C.click('#f-setup button[type=submit]'); await C.waitForSelector('#v-app:not([hidden])', { timeout: 60000 });
  for (let i = 0; i < 2; i++) { await C.click('#inv-new'); await C.waitForTimeout(400); } const codes = await C.$$eval('#invites code', e => e.map(x => x.textContent));
  const kid = (await T(C, '#kidline code')); ok('panel: enseña la huella de la llave', /^[0-9a-f]{16}$/.test(kid), kid);
  const A = await mk(); await profile(A, 'Marco', 73, 'dm2'); await addMeal(A, 'Arroz blanco cocido', 200); await go(A, '#datos');
  await A.click('#cloud-card [data-cl="register"]'); await A.waitForTimeout(200); await A.fill('#cl-email', 'marco@ejemplo.com'); await A.fill('#cl-pass', 'clave-de-marco-1'); await A.fill('#cl-pass2', 'clave-de-marco-1'); await A.fill('#cl-inv', codes[0]); await A.check('#cl-terms'); await A.check('#cl-hc'); await A.click('#cl-go'); await closed(A); await settle(A, 600);
  // 1. retirar el consentimiento de salud mientras hay un guardado en curso
  await get('/__delay?op=save&ms=2500'); await weigh(A, '72,8'); await go(A, '#datos'); await A.waitForTimeout(2700); // el guardado ya ha salido y sigue en vuelo
  await A.uncheck('#cl-health'); await A.waitForTimeout(9000); await get('/__delay?ms=0'); await settle(A, 800);
  let d = await dump(); ok('retirada del consentimiento durante un guardado: queda retirado', /datos de salud: no/.test(d.sheets.usuarios[1][4]) && !(await A.isChecked('#cl-health')), d.sheets.usuarios[1][4]);
  await C.click('#reload'); await C.waitForTimeout(500); await C.click('[data-see]'); await C.waitForSelector('#detail table', { timeout: 20000 }); ok('…y el entrenador ya no ve la salud', /No ha dado consentimiento/.test(await T(C, '#detail')) && !/Diabetes/.test(await T(C, '#detail')));
  // 2. cerrar sesión, cambios en otro dispositivo, volver a entrar: no pisa lo nuevo
  const B = await mk(); await B.goto(base + '/'); await B.waitForTimeout(400); await login(B, 'marco@ejemplo.com', 'clave-de-marco-1', '#v-need [data-cl="login"]');
  await go(B, '#datos'); await B.click('[data-cl="logout"]'); await B.waitForTimeout(300);
  ok('cerrar sesión: no quedan la sesión ni la llave en el dispositivo', await B.evaluate(() => { const c = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('elitepro:cloud:')))); return !c.token && !c.dek && c.out === true; }));
  await weigh(A, '70,0'); await addMeal(A, 'Patata cocida', 250); await settle(A);
  await login(B, 'marco@ejemplo.com', 'clave-de-marco-1'); await syncNow(A);
  let a = await local(A), bb = await local(B); ok('volver a entrar con datos viejos no pisa lo nuevo (peso 70, 2 comidas en los dos)', wts(a) === '70' && wts(bb) === '70' && meals(a) === 2 && meals(bb) === 2, wts(a) + ' ' + wts(bb) + ' ' + meals(a) + ' ' + meals(bb));
  // 3. cerrar sesión con un guardado en curso no devuelve la sesión
  await get('/__delay?op=save&ms=2500'); await weigh(B, '69,5'); await go(B, '#datos'); await B.waitForTimeout(2700); await B.click('[data-cl="logout"]'); await B.waitForTimeout(3500); await get('/__delay?ms=0'); await B.reload(); await B.waitForTimeout(800); await go(B, '#datos');
  ok('cerrar sesión durante un guardado: sigue cerrada tras recargar', await B.isVisible('#cloud-card [data-cl="register"]') && !(await B.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('elitepro:cloud:')))).token)));
  // 4. primer acceso desde un dispositivo que ya tenía otros datos
  const D = await mk(); await profile(D, 'Viejo', 80); await addMeal(D, 'Arroz blanco cocido', 100); await D.click('[data-go="-1"]'); await D.waitForTimeout(200); await addMeal(D, 'Arroz blanco cocido', 300); await go(D, '#datos');
  await syncNow(A); await login(D, 'marco@ejemplo.com', 'clave-de-marco-1'); await syncNow(A);
  a = await local(A); const dd = await local(D);
  ok('primer acceso con datos locales: en lo que coincide manda la nube y lo que solo había aquí se conserva', dd.profile.name === 'Marco' && a.profile.name === 'Marco' && Object.keys(dd.days).length === 2 && Object.keys(a.days).length === 2 && meals(dd) === meals(a) && meals(a) === 3, dd.profile.name + ' ' + Object.keys(dd.days).length + ' ' + meals(dd) + ' ' + meals(a));
  // 5. «Empezar de cero» no borra la nube
  await go(D, '#datos'); await D.click('#rs-ask'); await D.click('#rs-yes'); await D.waitForTimeout(4500);
  await syncNow(A); a = await local(A); ok('«Empezar de cero» en un dispositivo no vacía la cuenta ni los demás', a.profile && a.profile.name === 'Marco' && meals(a) === 3 && !(await D.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('elitepro:cloud:')))));
  // 6. cambio de contraseña: las demás sesiones caducan
  await login(B, 'marco@ejemplo.com', 'clave-de-marco-1');
  // 5b. recordatorios: los de medicación no salen del dispositivo ni con el consentimiento de salud; el plan sí llega al panel
  await go(A, '#datos'); if (!(await A.isChecked('#cl-health'))) { await A.check('#cl-health'); await settle(A, 1200); }
  for (const [kind, time] of [['med', '09:30'], ['comida', '08:00']]) { await A.click('#rem-box [data-sheet="rem"]'); await A.waitForTimeout(250); await A.selectOption('#r-kind', kind); await A.fill('#r-time', time); await A.click('#rem-form button[type=submit]'); await A.waitForTimeout(300); }
  await A.click('#diet-box [data-sheet="diet"]'); await A.waitForTimeout(250); await A.click('#sh-diet details.how summary'); await A.fill('#dt-kcal', '1700'); await A.fill('#dt-p', '140'); await A.click('#dt-save'); await A.waitForTimeout(300); await A.keyboard.press('Escape');
  await settle(A); await syncNow(B); let pb = (await local(B)).profile;
  ok('otro dispositivo recibe el plan y el aviso de comida, pero no el de medicación', pb.diet && pb.diet.tot.kcal === 1700 && (pb.rem || []).length === 1 && pb.medrem === undefined, JSON.stringify([pb.diet, pb.rem, pb.medrem]));
  d = await dump(); ok('servidor: consentimiento de salud activo y aun así nada de medicación', /datos de salud: sí/.test(d.sheets.usuarios[1][4]));
  await weigh(B, '69,0'); await settle(B); await syncNow(A); const pa = (await local(A)).profile;
  ok('quien lo creó conserva su aviso de medicación tras sincronizar', (pa.medrem || []).length === 1 && pa.medrem[0].time === '09:30' && (pa.rem || []).length === 1, JSON.stringify([pa.rem, pa.medrem]));
  await C.click('#reload'); await C.waitForTimeout(500); await C.click('[data-see]'); await C.waitForSelector('#detail table', { timeout: 20000 });
  ok('panel: el entrenador ve el plan pautado y ningún recordatorio de medicación', /Plan pautado/.test(await T(C, '#detail')) && /1\.?700 kcal/.test(await T(C, '#detail')) && !/09:30|Medicación/.test(await T(C, '#detail')), (await T(C, '#detail')).slice(0, 300)); await go(A, '#datos'); await A.click('[data-cl="passwd"]'); await A.waitForTimeout(200); await A.fill('#cl-pass', 'clave-de-marco-1'); await A.fill('#cl-new', 'clave-nueva-de-marco'); await A.fill('#cl-pass2', 'clave-nueva-de-marco'); await A.click('#cl-go'); await closed(A);
  await syncNow(A); ok('quien cambia la contraseña sigue conectado', /Conectada/.test(await T(A, '#cl-chip')));
  await go(B, '#datos'); await B.click('[data-cl="sync"]'); await B.waitForTimeout(1500); ok('los demás dispositivos tienen que volver a entrar', /caducada/i.test(await T(B, '#cl-chip')), await T(B, '#cl-chip'));
  // 6b. servidor ocupado: la app reintenta sola y acaba guardando
  d = await dump(); const rev0 = Number(d.sheets.usuarios[1][5]);
  await get('/__busy?on=1'); await weigh(A, '68,5'); setTimeout(() => get('/__busy?on=0'), 4500); await settle(A, 11000); d = await dump();
  await go(A, '#datos'); ok('con la nube ocupada la app reintenta sola y acaba guardando', Number(d.sheets.usuarios[1][5]) === rev0 + 1 && /Conectada/.test(await T(A, '#cl-chip')), d.sheets.usuarios[1][5] + ' / ' + rev0 + ' ' + await T(A, '#cl-chip'));
  // 7. la app solo cifra para la llave fijada
  if (pinned) {
    await get('/__clearcache'); const E = await mk(); await E.goto(base + '/fijada/index.html'); await E.waitForTimeout(400); await E.click('#v-need a'); await E.waitForTimeout(200); await E.fill('#p-name', 'Eva'); await E.fill('#p-age', '30'); await E.fill('#p-height', '165'); await E.fill('#p-weight', '60'); await E.click('#p-form button[type=submit]'); await E.waitForTimeout(400); await go(E, '#datos');
    await E.click('#cloud-card [data-cl="register"]'); await E.waitForTimeout(200); await E.fill('#cl-email', 'eva@ejemplo.com'); await E.fill('#cl-pass', 'clave-de-eva-123'); await E.fill('#cl-pass2', 'clave-de-eva-123'); await E.fill('#cl-inv', codes[1]); await E.check('#cl-terms'); await E.click('#cl-go');
    await E.waitForFunction(() => /llave del responsable/.test(document.querySelector('#cl-msg').textContent), null, { timeout: 30000 }); d = await dump();
    ok('llave del servidor distinta de la fijada en la app: no se registra ni se envía nada', !JSON.stringify(d.sheets.usuarios).includes('eva@ejemplo.com'));
  }
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')); fails++; } finally { await b.close(); srv.kill(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
