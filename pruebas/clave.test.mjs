// Ver la contraseña que se escribe y «He olvidado la contraseña» con un código que llega por correo.
// Uso: node pruebas/clave.test.mjs <carpeta construida con ELITEPRO_NUBE_URL=/api>
import { spawn } from 'node:child_process';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], port = 8794, base = 'http://localhost:' + port;
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
const code = async () => (await dump()).stats.mail.at(-1).body.match(/\b\d{6}\b/)[0];
const cloud = p => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('elitepro:cloud:')))));
const said = (p, re) => p.waitForFunction(s => new RegExp(s).test(document.querySelector('#cl-msg') ? document.querySelector('#cl-msg').textContent : ''), re.source, { timeout: 30000 });
const step2 = p => p.waitForSelector('#cl-code', { timeout: 30000 });
try {
  // panel: botón de ver la contraseña
  const C = await mk(); await C.goto(base + '/panel.html'); await C.waitForSelector('#v-setup:not([hidden])'); await C.fill('#s-code', await get('/__setup')); await C.fill('#s-pass', 'entrenador-clave-1');
  await C.click('#s-pass + [data-eye]'); ok('panel: el ojo enseña la contraseña', await C.getAttribute('#s-pass', 'type') === 'text' && await C.inputValue('#s-pass') === 'entrenador-clave-1' && await C.getAttribute('#s-pass2', 'type') === 'password');
  await C.fill('#s-pass2', 'entrenador-clave-1'); await C.click('#f-setup button[type=submit]'); await C.waitForSelector('#v-app:not([hidden])', { timeout: 30000 });
  ok('panel: al enviar vuelve a ir oculta', await C.getAttribute('#s-pass', 'type') === 'password');
  await C.click('#inv-new'); await C.waitForTimeout(500); const codes = await C.$$eval('#invites code', e => e.map(x => x.textContent));
  // app: botón de ver la contraseña al crear la cuenta
  const A = await mk(); await profile(A, 'Marco', 73, 'dm2'); await addMeal(A, 'Arroz blanco cocido', 200); await go(A, '#datos');
  await A.click('#cloud-card [data-cl="register"]'); await A.waitForTimeout(200); await A.fill('#cl-email', 'marco@ejemplo.com'); await A.fill('#cl-pass', 'clave-de-marco-1');
  ok('crear cuenta: las contraseñas llevan su botón y empiezan ocultas', await A.locator('#cl-form [data-eye]').count() === 2 && await A.getAttribute('#cl-pass', 'type') === 'password' && await A.getAttribute('#cl-pass + [data-eye]', 'aria-label') === 'Ver la contraseña');
  await A.click('#cl-pass + [data-eye]');
  ok('…al pulsarlo se ve lo escrito y el botón pasa a «Ocultar»', await A.getAttribute('#cl-pass', 'type') === 'text' && await A.inputValue('#cl-pass') === 'clave-de-marco-1' && await A.getAttribute('#cl-pass + [data-eye]', 'aria-label') === 'Ocultar la contraseña' && await A.getAttribute('#cl-pass2', 'type') === 'password');
  await A.click('#cl-pass + [data-eye]'); ok('…y al pulsarlo otra vez se oculta', await A.getAttribute('#cl-pass', 'type') === 'password' && await A.inputValue('#cl-pass') === 'clave-de-marco-1');
  await A.click('#cl-pass + [data-eye]'); await A.fill('#cl-pass2', 'clave-de-marco-1'); await A.fill('#cl-inv', codes[0]); await A.check('#cl-terms'); await A.check('#cl-hc'); await A.click('#cl-go'); await closed(A); await settle(A, 700);
  let d = await dump(); ok('cuenta creada con la contraseña a la vista', d.sheets.usuarios.length === 2 && /datos de salud: sí/.test(d.sheets.usuarios[1][4]));
  const rev0 = d.sheets.usuarios[1][5], blob0 = d.sheets.usuarios[1].slice(8).join('');
  // entrar: enlace de contraseña olvidada, con el correo ya puesto
  const B = await mk(); await B.goto(base + '/'); await B.waitForTimeout(400); await B.click('#v-need [data-cl="login"]'); await B.waitForTimeout(200);
  ok('entrar: botón de ver la contraseña y enlace «He olvidado la contraseña»', await B.locator('#cl-form [data-eye]').count() === 1 && /He olvidado la contraseña/.test(await T(B, '#cl-form')));
  await B.keyboard.press('Escape');
  // 1. olvido con la sesión abierta: no se pierde nada
  await go(A, '#datos'); await A.click('[data-cl="passwd"]'); await A.waitForTimeout(200); await A.click('#cl-form [data-cl="reset1"]'); await A.waitForTimeout(200);
  ok('con la sesión abierta: el correo es el de la cuenta y no se puede cambiar', await A.inputValue('#cl-email') === 'marco@ejemplo.com' && await A.getAttribute('#cl-email', 'readonly') !== null);
  await A.click('#cl-go'); await step2(A); d = await dump();
  ok('llega un correo con el código a la dirección de la cuenta', d.stats.mail.length === 1 && d.stats.mail[0].to === 'marco@ejemplo.com' && /\b\d{6}\b/.test(d.stats.mail[0].body));
  ok('con la llave en el dispositivo no hay aviso de pérdida de datos', /Tus datos no se tocan/.test(await T(A, '#cl-form')) && !(await A.$('#cl-sure')));
  await A.fill('#cl-code', '000000' === await code() ? '111111' : '000000'); await A.fill('#cl-new', 'clave-nueva-de-marco'); await A.fill('#cl-pass2', 'clave-nueva-de-marco'); await A.click('#cl-go'); await said(A, /código no vale/);
  ok('código equivocado: lo dice y no cambia nada', true);
  await A.fill('#cl-new', 'corta'); await A.fill('#cl-pass2', 'corta'); await A.click('#cl-go'); await A.waitForTimeout(200); ok('contraseña nueva demasiado corta: no se envía', await A.isVisible('#cl-code'));
  await A.fill('#cl-code', await code()); await A.fill('#cl-new', 'clave-nueva-de-marco'); await A.fill('#cl-pass2', 'clave-nueva-de-marco'); await A.click('#cl-go'); await closed(A); await settle(A, 900);
  d = await dump(); await go(A, '#datos');
  ok('código bueno: contraseña cambiada, sigue conectado y los datos de la nube están intactos', /Conectada/.test(await T(A, '#cl-chip')) && d.sheets.usuarios[1][5] === rev0 && d.sheets.usuarios[1].slice(8).join('') === blob0 && /datos de salud: sí/.test(d.sheets.usuarios[1][4]), d.sheets.usuarios[1][5] + ' ' + rev0);
  await B.click('#v-need [data-cl="login"]'); await B.waitForTimeout(200); await B.fill('#cl-email', 'marco@ejemplo.com'); await B.fill('#cl-pass', 'clave-de-marco-1'); await B.click('#cl-go'); await said(B, /incorrectos/);
  ok('la contraseña antigua ya no entra', true);
  await B.fill('#cl-pass', 'clave-nueva-de-marco'); await B.click('#cl-go'); await closed(B); await settle(B, 900); let bb = await local(B);
  ok('con la nueva, otro dispositivo recibe todos los datos (también los de salud)', bb.profile && bb.profile.name === 'Marco' && meals(bb) === 1 && bb.profile.health && bb.profile.health.cond === 'dm2', JSON.stringify(bb.profile && bb.profile.health));
  // 2. olvido con la sesión cerrada pero con los datos en el dispositivo
  await go(B, '#datos'); await B.click('[data-cl="logout"]'); await B.waitForTimeout(300); await addMeal(B, 'Patata cocida', 250); await go(B, '#datos');
  await get('/__clearcache'); await B.click('#cloud-card [data-cl="login"]'); await B.waitForTimeout(200); await B.fill('#cl-email', 'Marco@Ejemplo.com'); await B.click('#cl-form [data-cl="reset1"]'); await B.waitForTimeout(200);
  ok('desde «Entrar»: el correo escrito pasa al formulario del código', await B.inputValue('#cl-email') === 'marco@ejemplo.com' && await B.getAttribute('#cl-email', 'readonly') === null);
  await B.click('#cl-go'); await step2(B);
  ok('sin la llave: avisa de que la nube se sustituye por lo de este dispositivo y pide confirmarlo', /se queda con lo que hay ahora en este dispositivo/.test(await T(B, '#cl-form')) && await B.getAttribute('#cl-sure', 'required') !== null);
  await B.fill('#cl-code', await code()); await B.fill('#cl-new', 'tercera-clave-marco'); await B.click('#cl-new + [data-eye]'); await B.fill('#cl-pass2', 'tercera-clave-marco'); await B.click('#cl-go'); await B.waitForTimeout(400);
  ok('sin marcar la casilla no se envía', await B.isVisible('#cl-code'));
  await B.check('#cl-sure'); await B.click('#cl-go'); await closed(B); await settle(B, 900); d = await dump(); await go(B, '#datos');
  ok('con la casilla: contraseña cambiada y conectado', /Conectada/.test(await T(B, '#cl-chip')) && Number(d.sheets.usuarios[1][5]) === Number(rev0) + 1, d.sheets.usuarios[1][5]);
  ok('…queda anotado en el consentimiento y la salud deja de estar en la nube', /datos de salud: no/.test(d.sheets.usuarios[1][4]) && /contraseña restablecida/.test(d.sheets.usuarios[1][4]) && !(await B.isChecked('#cl-health')), d.sheets.usuarios[1][4]);
  bb = await local(B); ok('…y en el dispositivo no se pierde nada (2 comidas y la salud sigue aquí)', meals(bb) === 2 && bb.profile.health.cond === 'dm2');
  ok('el código no queda guardado en la hoja', !/"reset"/.test(JSON.stringify(d.sheets.usuarios)));
  await C.click('#reload'); await C.waitForTimeout(500); await C.click('[data-see]'); await C.waitForSelector('#detail table', { timeout: 20000 });
  ok('el entrenador sigue pudiendo leer la cuenta (las 2 comidas, sin salud)', /\d{4}-\d{2}-\d{2}\s*478/.test(await T(C, '#detail')) && /No ha dado consentimiento/.test(await T(C, '#detail')), (await T(C, '#detail')).slice(150, 900));
  // el primer dispositivo tenía la sesión antigua: caduca, vuelve a entrar con la nueva y no pisa nada
  await go(A, '#datos'); await A.click('[data-cl="sync"]'); await A.waitForTimeout(1500); ok('el otro dispositivo tiene que volver a entrar', /caducada/i.test(await T(A, '#cl-chip')), await T(A, '#cl-chip'));
  await login(A, 'marco@ejemplo.com', 'tercera-clave-marco', '#cloud-card [data-cl="login"]'); const a = await local(A); d = await dump();
  ok('al entrar con la nueva recibe lo que había y conserva su salud en el dispositivo', meals(a) === 2 && a.profile.health.cond === 'dm2' && /datos de salud: no/.test(d.sheets.usuarios[1][4]), meals(a) + ' ' + d.sheets.usuarios[1][4]);
  // 3. dispositivo vacío: el aviso lo dice claro; correo que no existe: misma pantalla y ningún correo
  await get('/__clearcache'); const E = await mk(); await E.goto(base + '/'); await E.waitForTimeout(400); await E.click('#v-need [data-cl="login"]'); await E.waitForTimeout(200); await E.fill('#cl-email', 'nadie@ejemplo.com'); await E.click('#cl-form [data-cl="reset1"]'); await E.waitForTimeout(200);
  const n0 = (await dump()).stats.mail.length; await E.click('#cl-go'); await step2(E);
  ok('correo sin cuenta: misma pantalla y no sale ningún correo', (await dump()).stats.mail.length === n0);
  ok('dispositivo sin datos: avisa de que la cuenta quedaría vacía', /tu cuenta se queda vacía/.test(await T(E, '#cl-form')));
  await E.click('#cl-form [data-cl="reset1"]'); await E.waitForTimeout(200); ok('«pedir otro código» vuelve al paso del correo con el mismo correo', await E.inputValue('#cl-email') === 'nadie@ejemplo.com');
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')); fails++; } finally { await b.close(); srv.kill(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
