// Amigos: perfil con foto, solicitudes por correo, aceptar, ver entrenos y comidas del amigo, cifrado de extremo a extremo y dejar de ser amigos.
// Uso: node pruebas/amigos.test.mjs <carpeta construida con ELITEPRO_NUBE_URL=/api>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], port = 8793, base = 'http://localhost:' + port;
const srv = spawn('node', [new URL('./servidor_prueba.mjs', import.meta.url).pathname, dir, String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch(); const errs = []; let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? 'OK    ' : 'FALLA ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
const mk = async () => { const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); return p; };
const T = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
const get = async u => (await fetch(base + u)).text(), dump = async () => JSON.parse(await get('/__dump'));
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
const settle = async (p, ms = 3600) => { await p.waitForTimeout(ms); await p.waitForFunction(() => !/Sincronizando/.test((document.querySelector('#cl-chip') || {}).textContent || ''), null, { timeout: 20000 }); };
const closed = p => p.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 });
const cloud = p => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('elitepro:cloud:'))) || 'null'));
const local = p => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('platoypista:v1:u:')))));
const until = (p, sel, re, ms = 30000) => p.waitForFunction(([s, r]) => new RegExp(r).test((document.querySelector(s) || {}).textContent || ''), [sel, re.source], { timeout: ms });
const png = dir + '/_cara.png'; fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const person = async (p, name, w, sex) => { await p.goto(base + '/'); await p.waitForTimeout(400); await p.click('#v-need a'); await p.waitForTimeout(200); await p.fill('#p-name', name); if (sex) await p.selectOption('#p-sex', sex); await p.fill('#p-age', '35'); await p.fill('#p-height', '170'); await p.fill('#p-weight', String(w)); await p.selectOption('#p-plan', 'dia'); await p.click('#p-form button[type=submit]'); await p.waitForTimeout(400); };
const register = async (p, mail, code) => { await go(p, '#datos'); await p.click('#cloud-card [data-cl="register"]'); await p.waitForTimeout(200); await p.fill('#cl-email', mail); await p.fill('#cl-pass', 'clave-de-prueba-1'); await p.fill('#cl-pass2', 'clave-de-prueba-1'); await p.fill('#cl-inv', code); await p.check('#cl-terms'); await p.click('#cl-go'); await closed(p); await settle(p, 2500); };
try {
  const C = await mk(); await C.goto(base + '/panel.html'); await C.waitForSelector('#v-setup:not([hidden])'); await C.fill('#s-code', await get('/__setup')); await C.fill('#s-pass', 'entrenador-clave-1'); await C.fill('#s-pass2', 'entrenador-clave-1'); await C.click('#f-setup button[type=submit]'); await C.waitForSelector('#v-app:not([hidden])', { timeout: 30000 });
  await C.click('#inv-new'); await C.waitForTimeout(500); await C.click('#inv-new'); await C.waitForTimeout(500); const codes = await C.$$eval('#invites code', e => e.map(x => x.textContent));
  const A = await mk(); await person(A, 'Bacilio', 80);
  await go(A, '#amigos'); ok('sin cuenta, Amigos explica que hace falta la cuenta en la nube', /necesitas tu cuenta en la nube/.test(await T(A, '#am-body')) && /nunca tu peso ni tus datos de salud/.test(await T(A, '#am-body')));
  await register(A, 'bacilio@ejemplo.com', codes[0]);
  await A.waitForFunction(() => { const k = Object.keys(localStorage).find(x => x.startsWith('elitepro:cloud:')); const c = k && JSON.parse(localStorage.getItem(k)); return !!(c && c.sk && c.fk); }, null, { timeout: 30000 });
  let ca = await cloud(A), D = await dump();
  ok('al crear la cuenta se crean sus llaves de amigos (la privada, guardada cifrada)', !!ca.sk && !!ca.spub && D.sheets.amigos_perfiles && D.sheets.amigos_perfiles.length === 2 && D.sheets.amigos_perfiles[1][1] === 'Bacilio' && !/"d"\s*:/.test(D.sheets.amigos_perfiles[1][3]) && D.sheets.amigos_perfiles[1][3].startsWith('k:'), JSON.stringify(D.sheets.amigos_perfiles || null).slice(0, 300));
  const B = await mk(); await person(B, 'Tania', 60, 'f'); await register(B, 'tania@ejemplo.com', codes[1]);
  await B.waitForFunction(() => { const k = Object.keys(localStorage).find(x => x.startsWith('elitepro:cloud:')); const c = k && JSON.parse(localStorage.getItem(k)); return !!(c && c.sk); }, null, { timeout: 30000 });
  // A pone foto, apunta comida y entreno en pareja, y pide amistad a B (y a un correo que no existe)
  await go(A, '#amigos'); await until(A, '#am-body', /Tus amigos/);
  await A.setInputFiles('#am-photo', png); await A.waitForTimeout(400); ok('se puede poner foto de perfil (recortada y ligera)', /^data:image\/jpeg;base64,/.test((await local(A)).profile.photo) && (await local(A)).profile.photo.length < 26000 && await A.isVisible('#am-body img.av'));
  await A.fill('#am-mail', 'nadie@ejemplo.com'); await A.click('#am-add button'); await until(A, '#am-body', /nadie@ejemplo\.com/);
  const S0 = (await dump()).stats; ok('a un correo sin cuenta le responde igual: no revela quién está registrado', /pendiente/.test(await T(A, '#am-body')));
  await A.fill('#am-mail', 'TANIA@ejemplo.com'); await A.click('#am-add button'); await until(A, '#am-body', /tania@ejemplo\.com/);
  await A.fill('#am-mail', 'tania@ejemplo.com'); await A.click('#am-add button'); await A.waitForTimeout(1500);
  ok('la solicitud queda pendiente y no se duplica', ((await T(A, '#am-body')).match(/tania@ejemplo\.com/g) || []).length === 1);
  await go(A, '#hoy'); await A.click('#nut-card [data-sheet="meal"]'); await A.waitForTimeout(200); await A.click('#f-manual'); await A.fill('#f-name', 'Pollo con arroz'); await A.fill('#f-g', '350'); await A.fill('#f-kcal', '520'); await A.click('#f-submit'); await A.waitForTimeout(300);
  await A.click('#train-card [data-sheet="act"]'); await A.waitForTimeout(200); await A.selectOption('#a-type', 'hibrido'); await A.fill('#a-min', '60'); await A.selectOption('#a-with', 'pareja'); await A.fill('#a-mate', 'Tania'); await A.click('#act-form button[type=submit]'); await A.waitForTimeout(300);
  await settle(A, 4500);
  D = await dump(); const rowA = D.sheets.amigos_perfiles.find(r => r[1] === 'Bacilio');
  ok('su perfil para amigos se sube cifrado: en la hoja no se lee ni la comida ni el entreno', rowA && rowA[6].length > 100 && !/Pollo|arroz|hibrido|Tania/.test(rowA[6]) && !/Pollo con arroz/.test(JSON.stringify(D.sheets.amigos_perfiles)), (rowA || []).slice(0, 2).join());
  // B ve la solicitud en Hoy y en Amigos, y la acepta
  await B.reload(); await B.waitForTimeout(4500); await go(B, '#hoy');
  await B.click('#guide-card [data-feel="ok"]').catch(() => {}); await B.waitForTimeout(600);
  ok('en Hoy avisa de que alguien quiere ser tu amigo', /Bacilio quiere ser tu amigo en Elitepro/.test(await T(B, '#guide-card')), (await T(B, '#guide-card')).slice(-200));
  await go(B, '#amigos'); await until(B, '#am-body', /Solicitudes para ti/);
  ok('Tania ve la solicitud de Bacilio (sin ver su correo)', /Bacilio\s*quiere ser tu amigo/.test(await T(B, '#am-body')) && !/bacilio@ejemplo\.com/.test(await T(B, '#am-body')));
  await B.click('[data-fr-ok]'); await until(B, '#am-body', /Tus amigos/); await B.waitForTimeout(1000);
  ok('al aceptar, son amigos (y Bacilio aún no le ha dado su llave)', /Bacilio/.test(await T(B, '#am-body .amlist')) && /Acabáis de ser amigos/.test(await T(B, '#am-body')), await T(B, '#am-body'));
  // A abre Amigos: da su llave a Tania y ya ve el perfil de ella
  await go(A, '#amigos'); await A.click('#am-reload'); await until(A, '#am-body .amlist', /Tania/); await A.waitForTimeout(800);
  ok('para Bacilio, Tania ya es su amiga y su solicitud enviada desaparece', /Tania/.test(await T(A, '#am-body')) && !/tania@ejemplo\.com/.test(await T(A, '#am-body')) && /nadie@ejemplo\.com/.test(await T(A, '#am-body')));
  await B.click('#am-reload'); await until(B, '#am-body .amlist', /Último entreno hoy/);
  ok('Tania ve el último entreno de Bacilio, en pareja', /Último entreno hoy: Híbrido \/ Hyrox · 60′ · en pareja con Tania/.test(await T(B, '#am-body')) && await B.isVisible('#am-body .amlist img.av'), await T(B, '#am-body .amlist'));
  await B.click('[data-fr-see]'); await B.waitForTimeout(300); const fb = await T(B, '#friend-body');
  ok('en su perfil ve sus entrenos y comidas de las dos últimas semanas', /Híbrido \/ Hyrox/.test(fb) && /520 kcal/.test(fb) && /Pollo con arroz/.test(await B.textContent('#friend-body')), fb);
  ok('…y nunca su peso', !/80 kg|peso/i.test(fb));
  await B.keyboard.press('Escape'); await B.waitForTimeout(200);
  // otro dispositivo de Bacilio: al entrar con su contraseña recupera las mismas llaves y ve a Tania
  const A2 = await mk(); await A2.goto(base + '/'); await A2.waitForTimeout(400); await A2.click('[data-cl="login"]'); await A2.waitForTimeout(200); await A2.fill('#cl-email', 'bacilio@ejemplo.com'); await A2.fill('#cl-pass', 'clave-de-prueba-1'); await A2.click('#cl-go'); await closed(A2); await settle(A2, 2500);
  await A2.waitForFunction(() => { const k = Object.keys(localStorage).find(x => x.startsWith('elitepro:cloud:')); const c = k && JSON.parse(localStorage.getItem(k)); return !!(c && c.sk); }, null, { timeout: 30000 });
  ok('en otro dispositivo, al entrar, recupera las mismas llaves', (await cloud(A2)).spub === ca.spub && (await cloud(A2)).fk === (await cloud(A)).fk);
  await go(A2, '#amigos'); await until(A2, '#am-body .amlist', /Tania/); ok('…y ve a sus amigos', /Tania/.test(await T(A2, '#am-body')));
  // sesión abierta de antes de esta versión: pide la contraseña una vez
  const ctx2 = A2.context(); await A2.close(); let once = false;
  await ctx2.addInitScript(() => { if (sessionStorage.getItem('hecho')) return; sessionStorage.setItem('hecho', '1'); const k = Object.keys(localStorage).find(x => x.startsWith('elitepro:cloud:')); const c = JSON.parse(localStorage.getItem(k)); delete c.sk; delete c.spub; delete c.fk; localStorage.setItem(k, JSON.stringify(c)); });
  const A3 = await ctx2.newPage(); A3.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); await A3.goto(base + '/#amigos'); await A3.waitForTimeout(1200); await go(A3, '#amigos');
  ok('con una sesión de antes, Amigos pide confirmar la contraseña una vez', /Activa Amigos/.test(await T(A3, '#am-body')), await T(A3, '#am-body'));
  await A3.fill('#am-pass', 'otra-clave-mala'); await A3.click('#am-on'); await until(A3, '#am-msg', /incorrecta/); ok('con la contraseña mal, lo dice', true);
  await A3.fill('#am-pass', 'clave-de-prueba-1'); await A3.click('#am-on'); await until(A3, '#am-body', /Tus amigos/);
  await until(A3, '#am-body', /Tania/); ok('con la buena, recupera sus llaves (las mismas) y sigue con sus amigos', (await cloud(A3)).spub === ca.spub && /Tania/.test(await T(A3, '#am-body')));
  // Tania deja de ser amiga de Bacilio: la llave de Tania cambia y Bacilio deja de verla
  const fkB = (await cloud(B)).fk; await B.click('[data-fr-see]'); await B.waitForTimeout(250); await B.click('[data-fr-del]'); await B.waitForTimeout(150);
  ok('dejar de ser amigos pide confirmación', /Pulsa otra vez/.test(await T(B, '#friend-body')));
  await B.click('[data-fr-del]'); await until(B, '#am-body', /Aún no tienes amigos aquí/);
  ok('al dejarlo, la llave de amigos de Tania cambia', (await cloud(B)).fk && (await cloud(B)).fk !== fkB);
  await A.click('#am-reload'); await A.waitForTimeout(2500); ok('y Bacilio ya no la tiene como amiga', !/Tania/.test(await T(A, '#am-body .card:has(#am-reload)')), await T(A, '#am-body'));
  await A.click('[data-fr-cancel]'); await A.waitForTimeout(1500); ok('se puede cancelar una solicitud enviada', !/nadie@ejemplo\.com/.test(await T(A, '#am-body')));
  // borrar la cuenta borra también su perfil para amigos
  await go(B, '#datos'); await B.click('[data-cl="remove"]'); await B.waitForTimeout(200); await B.fill('#cl-pass', 'clave-de-prueba-1'); await B.click('#cl-go'); await closed(B); await B.waitForTimeout(500);
  D = await dump(); ok('al borrar la cuenta se borra su perfil para amigos', !D.sheets.amigos_perfiles.some(r => r[1] === 'Tania'));
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')); fails++; } finally { await b.close(); srv.kill(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
