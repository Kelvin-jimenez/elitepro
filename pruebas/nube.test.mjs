// Prueba de punta a punta de la cuenta en la nube: dos dispositivos de un usuario y el panel del entrenador.
// Uso: node pruebas/nube.test.mjs <carpeta con index.html, panel.html y privacidad.html construidos con ELITEPRO_NUBE_URL=/api>
import { spawn } from 'node:child_process';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], port = 8791, base = 'http://localhost:' + port;
const srv = spawn('node', [new URL('./servidor_prueba.mjs', import.meta.url).pathname, dir, String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch(); const errs = []; let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? 'OK    ' : 'FALLA ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
const mk = async (w = 1280, h = 900) => { const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); return p; };
const T = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
const dump = async () => (await fetch(base + '/__dump')).json();
const settle = async (p, ms = 3600) => { await p.waitForTimeout(ms); await p.waitForFunction(() => !/Sincronizando/.test((document.querySelector('#cl-chip') || {}).textContent || ''), null, { timeout: 15000 }); };
const syncNow = async p => { await p.evaluate(() => { location.hash = '#datos'; }); await p.waitForTimeout(200); await p.click('[data-cl="sync"]'); await settle(p, 900); };
const cond = async p => { await p.evaluate(() => { location.hash = '#datos'; }); await p.waitForTimeout(250); return p.inputValue('#h-cond'); };
const glu = async p => { await p.evaluate(() => { location.hash = '#hoy'; }); await p.waitForTimeout(250); if (await p.isVisible('[data-go="0"]')) { await p.click('[data-go="0"]'); await p.waitForTimeout(250); } return (await p.isVisible('#glu-card')) ? T(p, '#d-glu') : ''; };
const cons = async p => { await p.evaluate(() => { location.hash = '#hoy'; }); await p.waitForTimeout(250); return T(p, '#d-label .kv'); };
const addMeal = async (p, name, g) => { await p.evaluate(() => { location.hash = '#hoy'; }); await p.waitForTimeout(200); await p.click('#nut-card [data-sheet="meal"]'); await p.waitForTimeout(200); await p.click('#f-manual'); await p.fill('#f-name', name); await p.fill('#f-g', String(g)); await p.waitForTimeout(100); await p.click('#f-submit'); await p.waitForTimeout(300); };
try {
  // --- entrenador: puesta en marcha e invitaciones
  const C = await mk(); await C.goto(base + '/panel.html'); await C.waitForSelector('#v-setup:not([hidden])');
  const code = await (await fetch(base + '/__setup')).text();
  await C.fill('#s-code', code); await C.fill('#s-pass', 'entrenador-clave-1'); await C.fill('#s-pass2', 'entrenador-clave-1'); await C.click('#f-setup button[type=submit]');
  await C.waitForSelector('#v-app:not([hidden])', { timeout: 60000 }); ok('panel: puesta en marcha y dentro', true);
  await C.click('#inv-new'); await C.waitForTimeout(400); await C.click('#inv-new'); await C.waitForTimeout(400);
  const codes = await C.$$eval('#invites code', els => els.map(e => e.textContent)); ok('panel: dos códigos de invitación', codes.length === 2, codes.join());
  // --- dispositivo A: perfil, datos y modo salud
  const A = await mk(); await A.goto(base + '/'); await A.waitForTimeout(400);
  ok('A: sin perfil ofrece «Ya tengo cuenta»', await A.isVisible('#v-need [data-cl="login"]'));
  await A.click('#v-need a'); await A.waitForTimeout(200);
  await A.fill('#p-name', 'Marco'); await A.fill('#p-age', '35'); await A.fill('#p-height', '167'); await A.fill('#p-weight', '73'); await A.selectOption('#p-plan', 'dia'); await A.selectOption('#h-cond', 'dm2');
  await A.click('#p-form button[type=submit]'); await A.waitForTimeout(400);
  await addMeal(A, 'Arroz blanco cocido', 200);
  await A.click('#glu-card [data-sheet="glu"]'); await A.waitForTimeout(200); await A.fill('#g-val', '104'); await A.click('#g-form button[type=submit]'); await A.waitForTimeout(300);
  ok('A: aviso de que solo se guarda aquí, con mención a la cuenta', /Crea una cuenta en Perfil/.test(await T(A, '#banner')));
  await A.evaluate(() => { location.hash = '#datos'; }); await A.waitForTimeout(200);
  ok('A: tarjeta de cuenta en Perfil', await A.isVisible('#cloud-card [data-cl="register"]'));
  const pd = await A.evaluate(() => { const before = document.querySelector('#p-name').value; return before; });
  await A.click('#cloud-card [data-cl="register"]'); await A.waitForTimeout(200);
  await A.fill('#cl-email', ' Marco@Ejemplo.com '); await A.fill('#cl-pass', 'clave-de-marco-1'); await A.fill('#cl-pass2', 'clave-de-marco-2'); await A.fill('#cl-inv', codes[0]); await A.check('#cl-terms');
  await A.click('#cl-go'); await A.waitForTimeout(200); ok('registro: contraseñas distintas, aviso', /no coinciden/.test(await T(A, '#cl-msg')));
  await A.fill('#cl-pass2', 'clave-de-marco-1'); await A.fill('#cl-inv', 'EP-AAAA-AAAA'); await A.click('#cl-go'); await A.waitForFunction(() => /invitación/.test(document.querySelector('#cl-msg').textContent), null, { timeout: 30000 }); ok('registro: invitación falsa, aviso', true);
  await A.fill('#cl-inv', codes[0].toLowerCase()); await A.click('#cl-go');
  await A.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 });
  ok('A: cuenta creada, conectada y sin aviso', /Conectada/.test(await T(A, '#cl-chip')) && !(await A.isVisible('#banner')), await T(A, '#cl-chip'));
  ok('A: el formulario de perfil no se ha tocado', (await A.inputValue('#p-name')) === 'Marco');
  await settle(A, 500);
  let d = await dump(), raw = JSON.stringify(d);
  ok('servidor: correo en claro para poder contactar, y nada más legible', raw.includes('marco@ejemplo.com') && !/Arroz|Marco"|dm2|clave-de-marco|"kcal"|"weight"/.test(raw));
  ok('servidor: consentimiento registrado sin datos de salud', /mayor de edad: sí · datos de salud: no/.test(d.sheets.usuarios[1][4]), d.sheets.usuarios[1][4]);
  ok('servidor: la invitación queda usada', d.sheets.invitaciones.some(r => r[2] === 'marco@ejemplo.com'));
  // --- entrenador ve los datos, sin salud
  await C.click('#reload'); await C.waitForTimeout(500); await C.click('[data-see]'); await C.waitForSelector('#detail table', { timeout: 20000 });
  let det = await T(C, '#detail'); ok('panel: descifra y muestra nombre, peso y comidas', /Marco/.test(det) && /73,0 kg/.test(det) && /260/.test(det), det.slice(0, 200));
  ok('panel: sin consentimiento no hay datos de salud', /No ha dado consentimiento/.test(det) && !/Diabetes|104/.test(det));
  // --- dispositivo B: entra y recibe los datos
  const B = await mk(400, 860); await B.goto(base + '/'); await B.waitForTimeout(400); await B.click('#v-need [data-cl="login"]'); await B.waitForTimeout(200);
  await B.fill('#cl-email', 'marco@ejemplo.com'); await B.fill('#cl-pass', 'otra-clave-mala'); await B.click('#cl-go'); await B.waitForFunction(() => /incorrectos/.test(document.querySelector('#cl-msg').textContent), null, { timeout: 30000 }); ok('B: contraseña mala, aviso', true);
  await B.fill('#cl-pass', 'clave-de-marco-1'); await B.click('#cl-go'); await B.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 }); await settle(B, 600);
  ok('B: recibe perfil y comidas', /Marco/.test(await T(B, '#d-nav')) && /260/.test(await cons(B)), await cons(B));
  ok('B: los datos de salud no han viajado', (await glu(B)) === '' && (await cond(B)) === '');
  // --- B añade, A lo recibe sin perder su salud local
  await addMeal(B, 'Patata cocida', 250); await settle(B);
  await syncNow(A); ok('A: recibe la comida de B (478 kcal)', /478/.test(await cons(A)), await cons(A));
  ok('A: conserva su modo salud y su lectura de glucosa', /104/.test(await glu(A)) && (await cond(A)) === 'dm2');
  // --- cambios en los dos a la vez, en días distintos
  await A.evaluate(() => { location.hash = '#hoy'; }); await A.waitForTimeout(250); await A.click('#peso-card [data-sheet="peso"]'); await A.waitForTimeout(200); await A.fill('#w-val', '72,4'); await A.click('#w-form button[type=submit]');
  await B.evaluate(() => { location.hash = '#hoy'; }); await B.waitForTimeout(200); await B.click('[data-go="-1"]'); await B.waitForTimeout(200); await addMeal(B, 'Arroz blanco cocido', 100);
  await settle(A); await settle(B); await syncNow(A); await syncNow(B);
  const a1 = await A.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('platoypista:v1:u:'))))), b1 = await B.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('platoypista:v1:u:')))));
  const dates = o => Object.keys(o.days).sort().join(), tw = o => Object.values(o.days).map(x => x.weight || 0).reduce((x, y) => x + y, 0), tm = o => Object.values(o.days).reduce((n, x) => n + x.meals.length, 0);
  ok('cambios simultáneos: los dos acaban con lo mismo (2 días, 3 comidas, peso 72,4)', dates(a1) === dates(b1) && Object.keys(a1.days).length === 2 && tm(a1) === 3 && tm(b1) === 3 && tw(a1) === 72.4 && tw(b1) === 72.4, dates(a1) + ' | ' + dates(b1) + ' ' + tm(a1) + ' ' + tm(b1) + ' ' + tw(a1) + ' ' + tw(b1));
  // --- consentimiento de salud: activar en A
  await A.evaluate(() => { location.hash = '#datos'; }); await A.waitForTimeout(200); await A.check('#cl-health'); await settle(A, 1200);
  d = await dump(); ok('servidor: consentimiento de salud anotado con fecha', /datos de salud: sí/.test(d.sheets.usuarios[1][4]), d.sheets.usuarios[1][4]);
  await C.click('#reload'); await C.waitForTimeout(500); await C.click('[data-see]'); await C.waitForFunction(() => /Diabetes tipo 2/.test(document.querySelector('#detail').textContent), null, { timeout: 20000 });
  det = await T(C, '#detail'); ok('panel: ahora sí ve condición y glucosa', /Diabetes tipo 2/.test(det) && /104 mg\/dl/.test(det));
  await addMeal(B, 'Patata cocida', 50); await settle(B); // B no sabía que el consentimiento había cambiado: debe enterarse y no pisar la salud de A
  ok('B: adopta el consentimiento y recibe la salud', (await cond(B)) === 'dm2' && await B.isChecked('#cl-health') && /104/.test(await glu(B)), await cond(B));
  await syncNow(A); ok('A: sigue con su salud y recibe lo de B', /104/.test(await glu(A)) && (await cond(A)) === 'dm2');
  // --- retirar el consentimiento de salud
  await A.evaluate(() => { location.hash = '#datos'; }); await A.waitForTimeout(200); await A.uncheck('#cl-health'); await settle(A, 1200);
  await C.click('[data-see]'); await C.waitForFunction(() => /No ha dado consentimiento/.test(document.querySelector('#detail').textContent), null, { timeout: 20000 }); ok('panel: al retirarlo, la salud desaparece de la nube', !/Diabetes|104 mg/.test(await T(C, '#detail')));
  ok('A: la salud sigue en su dispositivo', (await A.inputValue('#h-cond')) === 'dm2');
  await addMeal(B, 'Patata cocida', 30); await settle(B); await C.click('[data-see]'); await C.waitForTimeout(1500);
  ok('B (que aún no lo sabía) no vuelve a subir la salud', /No ha dado consentimiento/.test(await T(C, '#detail')) && !/Diabetes/.test(await T(C, '#detail')) && (await cond(B)) === 'dm2' && !(await B.isChecked('#cl-health')));
  // --- otra persona en el mismo dispositivo no hereda la cuenta
  await A.selectOption('#who', '__add'); await A.waitForTimeout(400);
  ok('A: otra persona en el mismo móvil no tiene cuenta', await A.isVisible('#cloud-card [data-cl="register"]') && /Crea una cuenta/.test(await T(A, '#banner')));
  await A.selectOption('#who', { index: 0 }); await A.waitForTimeout(600); await A.evaluate(() => { location.hash = '#datos'; }); await A.waitForTimeout(200);
  ok('A: al volver a Marco sigue conectada', /marco@ejemplo.com/.test(await T(A, '#cl-body')));
  // --- cambio de contraseña
  await A.click('[data-cl="passwd"]'); await A.waitForTimeout(200); await A.fill('#cl-pass', 'clave-de-marco-1'); await A.fill('#cl-new', 'clave-nueva-de-marco'); await A.fill('#cl-pass2', 'clave-nueva-de-marco'); await A.click('#cl-go');
  await A.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 }); ok('A: contraseña cambiada', true);
  await cond(B); await B.click('[data-cl="logout"]'); await B.waitForTimeout(200); ok('B: cerrar sesión deja los datos en el dispositivo', await B.isVisible('#cloud-card [data-cl="login"]') && /Marco/.test(await B.inputValue('#p-name')));
  await B.click('#cloud-card [data-cl="login"]'); await B.waitForTimeout(200); await B.fill('#cl-email', 'marco@ejemplo.com'); await B.fill('#cl-pass', 'clave-de-marco-1'); await B.click('#cl-go'); await B.waitForFunction(() => /incorrectos/.test(document.querySelector('#cl-msg').textContent), null, { timeout: 30000 });
  await B.fill('#cl-pass', 'clave-nueva-de-marco'); await B.click('#cl-go'); await B.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 }); await settle(B, 600);
  await cond(B); ok('B: la vieja ya no vale y con la nueva entra y descifra', /Conectada/.test(await T(B, '#cl-chip')));
  // --- sesión caducada
  await B.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('elitepro:cloud:')), c = JSON.parse(localStorage.getItem(k)); c.token = 'x.1.y'; localStorage.setItem(k, JSON.stringify(c)); }); await B.reload(); await B.waitForTimeout(1500); await B.evaluate(() => { location.hash = '#datos'; }); await B.waitForTimeout(300);
  ok('B: sesión caducada, pide volver a entrar y avisa', /caducada/i.test(await T(B, '#cl-chip')) && await B.isVisible('#cloud-card [data-cl="login"]'), await T(B, '#cl-chip'));
  // --- el entrenador renueva su llave
  const code2 = await (await fetch(base + '/__setup')).text(); await C.click('#out'); await C.click('#to-setup'); await C.fill('#s-code', code2); await C.fill('#s-pass', 'entrenador-clave-2'); await C.fill('#s-pass2', 'entrenador-clave-2'); await C.click('#f-setup button[type=submit]');
  await C.waitForSelector('#v-app:not([hidden])', { timeout: 60000 }); await C.waitForTimeout(600); await C.click('[data-see]'); await C.waitForTimeout(1200);
  ok('panel: tras renovar la llave avisa de que falta que el usuario abra la app', /todavía no ha abierto la app/.test(await T(C, '#detail')));
  await syncNow(A); await C.click('[data-see]'); await C.waitForSelector('#detail table', { timeout: 20000 }); ok('panel: cuando el usuario sincroniza, vuelve a ver sus datos', /Marco/.test(await T(C, '#detail')));
  await C.click('#out'); await C.fill('#l-pass', 'entrenador-clave-1'); await C.click('#f-login button[type=submit]'); await C.waitForFunction(() => /incorrecta/.test(document.querySelector('#l-msg').textContent), null, { timeout: 30000 });
  await C.fill('#l-pass', 'entrenador-clave-2'); await C.click('#f-login button[type=submit]'); await C.waitForSelector('#v-app:not([hidden])', { timeout: 30000 }); ok('panel: entra con la contraseña nueva y no con la vieja', true);
  // --- borrar la cuenta
  await A.evaluate(() => { location.hash = '#datos'; }); await A.waitForTimeout(200); await A.click('[data-cl="remove"]'); await A.waitForTimeout(200); await A.fill('#cl-pass', 'clave-nueva-de-marco'); await A.click('#cl-go');
  await A.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 });
  d = await dump(); ok('borrar cuenta: desaparece del servidor y los datos siguen en el dispositivo', d.sheets.usuarios.length === 1 && await A.isVisible('#cloud-card [data-cl="register"]') && (await A.inputValue('#p-name')) === 'Marco', JSON.stringify(d.sheets.usuarios).slice(0, 120));
  await C.waitForTimeout(300); await C.click('#reload'); await C.waitForTimeout(600); ok('panel: 0 usuarios', /Todavía no hay usuarios/.test(await T(C, '#users')));
  const P = await mk(); await P.goto(base + '/privacidad.html'); ok('política de privacidad publicada', /Política de privacidad/.test(await T(P, 'h1')) && /consentimiento explícito/.test(await T(P, 'main')));
  await A.screenshot({ path: dir + '/../n-perfil.png' });
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')); fails++; } finally { await b.close(); srv.kill(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
