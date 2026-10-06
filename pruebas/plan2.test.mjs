// Plan pautado leído de un documento largo: PDF troceado por páginas, lectura por tandas, tipos de día, opciones y cantidades por sexo y peso.
// Uso: node pruebas/plan2.test.mjs <carpeta construida con ELITEPRO_NUBE_URL=/api>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], port = 8797, base = 'http://localhost:' + port;
const srv = spawn('node', [new URL('./servidor_prueba.mjs', import.meta.url).pathname, dir, String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch(); const errs = []; let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? 'OK    ' : 'FALLA ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
const mk = async () => { const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); return p; };
const T = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
const get = async u => (await fetch(base + u)).text(), dump = async () => JSON.parse(await get('/__dump'));
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
const settle = async (p, ms = 700) => { await p.waitForTimeout(ms); await p.waitForFunction(() => !/Sincronizando/.test((document.querySelector('#cl-chip') || {}).textContent || ''), null, { timeout: 20000 }); };
const closed = p => p.waitForFunction(() => !document.querySelector('#sh-cloud').open, null, { timeout: 30000 });
const local = p => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('platoypista:v1:u:')))));
const ai = q => get('/__ai?' + q), sent = async () => (await dump()).stats.ai, map = m => ai('map=' + encodeURIComponent(m ? JSON.stringify(m) : ''));
const read = (p, re = /Plan leído/) => p.waitForFunction(r => new RegExp(r).test((document.querySelector('#dt-msg') || {}).textContent || ''), re.source, { timeout: 60000 });
const txt = body => body.messages[0].content.find(c => c.type === 'text').text, imgs = body => body.messages[0].content.filter(c => c.type === 'image');

// --- un PDF de 7 páginas, como los planes en diapositivas: portada, tablas por sexo y peso, portada de apartado y una página sin cantidades
const rows = (a, b2) => [['Mujer', '50–60 kg'], ['Mujer', '60–70 kg'], ['Mujer', '+70 kg'], ['Hombre', '60–75 kg'], ['Hombre', '75–90 kg'], ['Hombre', '+90 kg']].map((r, i) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${a[i]}</td><td>${b2[i]}</td></tr>`).join('');
const slide = (h, sub, th, a, b2) => `<section><h1>${h}</h1><h2>${sub}</h2><table><tr><th>Sexo</th><th>Peso</th><th>${th[0]}</th><th>${th[1]}</th></tr>${rows(a, b2)}</table></section>`;
const html = `<style>section{page-break-after:always;height:600px;padding:30px;font-family:sans-serif}section:last-of-type{page-break-after:auto}td,th{padding:8px 30px;text-align:left}</style>
<section><h1>Tu plan de 4 semanas</h1><p>Nutrición de prueba</p></section>
${slide('Comida Días Intensos — Opción 1', 'Arroz + pollo', ['Arroz crudo', 'Pollo'], ['70 g', '80 g', '90 g', '100 g', '120 g', '140 g'], ['120 g', '140 g', '160 g', '180 g', '200 g', '220 g'])}
${slide('Comida Días Intensos — Opción 2', 'Pasta + ternera', ['Pasta cruda', 'Ternera'], ['70 g', '80 g', '90 g', '100 g', '120 g', '140 g'], ['120 g', '140 g', '160 g', '180 g', '200 g', '220 g'])}
${slide('Cena Días Intensos — Opción 1', 'Merluza + patata', ['Merluza', 'Patata'], ['120 g', '140 g', '160 g', '180 g', '200 g', '220 g'], ['180 g', '220 g', '250 g', '300 g', '350 g', '450 g'])}
<section><h1>Días de descanso</h1></section>
${slide('Desayuno — Opción 1', 'Yogur natural + fruta', ['Yogur natural', 'Fruta'], ['150 g', '200 g', '250 g', '250 g', '300 g', '350 g'], ['1 pieza', '1 pieza', '1–2 piezas', '1 pieza', '1–2 piezas', '2 piezas'])}
<section><h1>Día de Competición</h1><h2>60–90 min antes</h2><ul><li>Opción 1: Bebida isotónica + plátano</li></ul><p>No pruebes nada nuevo el día de la carrera.</p></section>`;
const pdf = dir + '/_plan_largo.pdf';
{ const g = await b.newPage(); await g.setContent(html); await g.pdf({ path: pdf, width: '1280px', height: '720px' }); await g.close(); }
const png = dir + '/_plan.png'; fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const R = (a, b2) => [['f', 50, 60], ['f', 60, 70], ['f', 70, 0], ['m', 60, 75], ['m', 75, 90], ['m', 90, 0]].map((r, i) => r.concat([a[i], b2[i]]));
const col = (n, k, p, c, f, u = 'g', gu = 0) => ({ n, u, gu, k, p, c, f });
const P2 = { pg: 2, kind: 'Días Intensos', slot: 'com', mom: 'Comida', opt: 'Arroz + pollo', cols: [col('Arroz crudo', 360, 7, 79, 1), col('Pollo', 110, 23, 0, 2)], rows: R(['70', '80', '90', '100', '120', '140'], ['120', '140', '160', '180', '200', '220']) };
const P3 = { pg: 3, kind: 'Días intensos', slot: 'com', mom: 'Comida', opt: 'Pasta + ternera', cols: [col('Pasta cruda', 350, 12, 72, 1.5), col('Ternera', 130, 21, 0, 5)], rows: R(['70', '80', '90', '100', '120', '140'], ['120', '140', '160', '180', '200', '220']) };
const P4 = { pg: 4, kind: '🔴 Días intensos', slot: 'cen', mom: 'Cena', opt: 'Merluza + patata', cols: [col('Merluza', 80, 17, 0, 1.5), col('Patata', 80, 2, 17, 0.1)], rows: R(['120', '140', '160', '180', '200', '220'], ['180', '220', '250', '300', '350', '450']) };
const P5 = { pg: 5, sec: 'Días de descanso' };
const P6 = { pg: 6, kind: '', slot: 'des', mom: 'Desayuno', opt: 'Yogur natural + fruta', cols: [col('Yogur natural', 60, 4, 5, 3), col('Fruta', 50, 1, 12, 0, 'ud', 150)], rows: R(['150', '200', '250', '250', '300', '350'], ['1', '1', '1–2', '1', '1-2', '2']) };
const P7 = { pg: 7, kind: 'Día de Competición', slot: 'ent', mom: '60–90 min antes', opt: 'Bebida isotónica + plátano', cols: [col('Bebida isotónica', 25, 0, 6, 0, 'ml'), col('Plátano', 90, 1, 21, 0, 'ud', 120)], rows: [['', 0, 0, '', '']] };
const N7 = [{ pg: 7, kind: 'Día de Competición', t: 'No pruebes nada nuevo el día de la carrera.' }, { pg: 6, kind: '', t: 'Bebe agua durante todo el día.' }];
const J = (blocks, notes = [], by = '') => JSON.stringify({ by, blocks, notes, tots: [] });

try {
  const C = await mk(); await C.goto(base + '/panel.html'); await C.waitForSelector('#v-setup:not([hidden])'); await C.fill('#s-code', await get('/__setup')); await C.fill('#s-pass', 'entrenador-clave-1'); await C.fill('#s-pass2', 'entrenador-clave-1'); await C.click('#f-setup button[type=submit]'); await C.waitForSelector('#v-app:not([hidden])', { timeout: 30000 });
  await C.click('#inv-new'); await C.waitForTimeout(500); const codes = await C.$$eval('#invites code', e => e.map(x => x.textContent));
  const A = await mk(); await A.goto(base + '/'); await A.waitForTimeout(400); await A.click('#v-need a'); await A.waitForTimeout(200);
  await A.fill('#p-name', 'Tania'); await A.selectOption('#p-sex', 'f'); await A.fill('#p-age', '40'); await A.fill('#p-height', '160'); await A.fill('#p-weight', '60'); await A.selectOption('#p-plan', 'dia'); await A.click('#p-form button[type=submit]'); await A.waitForTimeout(400);
  await ai('key=sk-prueba-9');
  await go(A, '#datos'); await A.click('#cloud-card [data-cl="register"]'); await A.waitForTimeout(200); await A.fill('#cl-email', 'tania@ejemplo.com'); await A.fill('#cl-pass', 'clave-de-tania-1'); await A.fill('#cl-pass2', 'clave-de-tania-1'); await A.fill('#cl-inv', codes[0]); await A.check('#cl-terms'); await A.check('#cl-hc'); await A.click('#cl-go'); await closed(A); await settle(A);

  // ---- 1. PDF de 7 páginas: dos tandas (1–4 y 5–7)
  await map({ '1-4': J([P2, P3, P4], [], 'Nutrición de prueba'), '5-7': J([P5, P6, P7], N7) });
  await go(A, '#datos'); await A.click('#diet-box [data-sheet="diet"]:not([data-up])'); await A.waitForTimeout(300);
  ok('el plan se puede subir en PDF o foto y avisa de que lee documentos largos', /Subir mi plan en PDF o foto/.test(await T(A, '#diet-body')) && /aunque sea largo/.test(await T(A, '#diet-body')));
  let n0 = (await sent()).length; await A.setInputFiles('#dt-file', pdf);
  await A.waitForSelector('#ai-ok[open]', { timeout: 30000 }); await A.click('#ai-ok-yes'); await read(A);
  let S1 = (await sent()).slice(n0), L = await local(A), ks = L.profile.diet.kinds;
  ok('lee las 7 páginas en dos tandas (4 + 3) y lo dice', S1.length === 2 && /3 tipos de día y 5 opciones/.test(await T(A, '#dt-msg')), S1.length + ' · ' + await T(A, '#dt-msg'));
  const first = S1.find(x => /las páginas 1 a 4 de 7/.test(txt(x.body))), second = S1.find(x => /las páginas 5 a 7 de 7/.test(txt(x.body)));
  ok('cada tanda lleva las páginas como imágenes JPEG, no el PDF', !!first && !!second && imgs(first.body).length === 4 && imgs(second.body).length === 3 && imgs(first.body).every(i => i.source.media_type === 'image/jpeg' && i.source.data.length > 2000) && !first.body.messages[0].content.some(c => c.type === 'document'));
  ok('…y el texto propio del PDF, para no bailar cifras', /Texto de la página 2/.test(txt(first.body)) && /Arroz crudo/.test(txt(first.body)) && /Mujer( \|)? 60–70 kg( \|)? 80 g( \|)? 140 g/.test(txt(first.body)) && first.body.max_tokens === 4000, txt(first.body).slice(-600));
  ok('la tanda con la primera página va sola y antes (ahí se pide el permiso)', S1[0] === first);
  ok('agrupa por tipo de día aunque el título cambie de forma (3 tipos: intenso, descanso, competición)', ks.length === 3 && ks.map(k => k.h).join() === 'intenso,descanso,comp' && ks[0].n === 'Días Intensos', JSON.stringify(ks.map(k => [k.n, k.h])));
  ok('una página sin tipo de día hereda el de la portada de su apartado', ks[1].moms.length === 1 && ks[1].moms[0].s === 'des' && ks[1].moms[0].opts[0].n === 'Yogur natural + fruta' && ks[1].notes[0] === 'Bebe agua durante todo el día.');
  ok('las opciones de una misma comida van juntas (comida: 2, cena: 1) con sus 6 filas', ks[0].moms.length === 2 && ks[0].moms[0].opts.length === 2 && ks[0].moms[1].opts.length === 1 && ks[0].moms[0].opts[0].rows.length === 6 && ks[0].moms[0].opts[0].rows[1].join() === 'f,60,70,80,140');
  ok('guarda quién lo pauta y las pautas del tipo de día', L.profile.diet.by === 'Nutrición de prueba' && ks[2].notes[0] === 'No pruebes nada nuevo el día de la carrera.');
  let body = await T(A, '#diet-body');
  ok('la vista del plan enseña los tipos de día con sus calorías aproximadas y mis cantidades', /Días Intensos\s*3 opciones/.test(body) && /Días de descanso\s*1 opción/.test(body) && /Arroz crudo 80 g · Pollo 140 g/.test(body) && /Automático, según mi peso \(60–70 kg\)/.test(body), body.slice(0, 900));

  // ---- 2. Hoy: tipo de día automático, opciones con mis cantidades y apuntar con un toque
  await A.keyboard.press('Escape'); await A.waitForTimeout(200); await go(A, '#hoy');
  let dc = await T(A, '#diet-card');
  ok('sin entreno, Hoy elige solo «Días de descanso» y dice para quién son las cantidades', /Automático: Días de descanso/.test(dc) && /Cantidades para mujer 60–70 kg/.test(dc) && /Bebe agua/.test(dc), dc);
  ok('el desayuno ofrece «Elegir del plan»; la comida, no (ese tipo de día no la trae)', await A.isVisible('#nut-card [data-plan-slot="des"]') && !(await A.isVisible('#nut-card [data-plan-slot="com"]')));
  await A.click('#nut-card [data-plan-slot="des"]'); await A.waitForTimeout(250); let po = await T(A, '#popt-body');
  ok('la opción sale con la fila de mujer 60–70 kg (200 g, 1 ud) y sus calorías', /Yogur natural 200 g · Fruta 1 ud/.test(po) && /≈ 195 kcal/.test(po), po);
  await A.click('#popt-body [data-log-opt]'); await A.waitForTimeout(400); L = await local(A); let ms = Object.values(L.days)[0].meals;
  ok('un toque apunta los alimentos con sus gramos y calorías (120 + 75 kcal)', ms.length === 2 && ms[0].name === 'Yogur natural' && ms[0].g === 200 && ms[0].kcal === 120 && ms[1].name === 'Fruta (1 ud)' && ms[1].g === 150 && ms[1].kcal === 75 && ms[0].slot === 'des' && /195/.test(await T(A, '#d-label .kv')), JSON.stringify(ms));
  ok('con un plan que deja elegir, el objetivo del día sigue siendo el cálculo de la app', !/Objetivo: tu plan pautado/.test(await T(A, '#d-label')));
  await A.selectOption('[data-kind-sel]', { label: 'Días Intensos' }); await A.waitForTimeout(300); dc = await T(A, '#diet-card');
  ok('puedo cambiar el tipo de día a mano: pasa a «Días Intensos» con su margen de calorías', /Elegido por ti/.test(dc) && /Tu plan\s*7\d0 kcal/.test(dc) && /≈ 1340/.test(dc) && /estimación/.test(dc), dc);
  ok('el aviso de déficit grande es prudente y manda a quien lo pautó', /va por debajo del gasto a propósito/.test(dc) && /cambios en el ciclo/.test(dc) && /enséñaselo a Nutrición de prueba/.test(dc), dc);
  await A.click('#nut-card [data-plan-slot="com"]'); await A.waitForTimeout(250); po = await T(A, '#popt-body');
  ok('la comida de un día intenso da a elegir entre sus 2 opciones', /Arroz \+ pollo/.test(po) && /Pasta \+ ternera/.test(po) && /Arroz crudo 80 g · Pollo 140 g/.test(po) && (await A.locator('#popt-body [data-log-opt]').count()) === 2, po);
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  // la fila se puede fijar a mano
  await go(A, '#datos'); await A.click('#diet-box [data-sheet="diet"]:not([data-up])'); await A.waitForTimeout(300); await A.selectOption('#dt-row', '50-60'); await A.waitForTimeout(300);
  ok('puedo fijar mi fila de cantidades (50–60 kg): cambian a 70 g y 120 g', /Arroz crudo 70 g · Pollo 120 g/.test(await T(A, '#diet-body')) && (await local(A)).profile.diet.row === '50-60', (await T(A, '#diet-body')).slice(0, 500));
  await A.selectOption('#dt-row', ''); await A.waitForTimeout(200);
  await A.click('#diet-body details.kd summary'); await A.waitForTimeout(150); await A.click('#diet-body [data-del-opt]'); await A.waitForTimeout(300); L = await local(A);
  ok('puedo quitar una opción que no cuadre (quedan 4) y el apartado sigue abierto', L.profile.diet.kinds[0].moms[0].opts.length === 1 && await A.evaluate(() => document.querySelector('#diet-body details.kd').open));
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);

  // ---- 3. Competición hoy: el tipo de día pasa a competición; una opción sin cantidades abre el formulario
  await go(A, '#hoy'); await A.selectOption('[data-kind-sel]', ''); await A.waitForTimeout(200);
  const hoy = await A.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await A.click('.nav-side a[data-tab="comp"]'); await A.waitForTimeout(150); await A.click('#v-comp [data-sheet="ev"]'); await A.waitForTimeout(200); await A.fill('#ev-name', 'Strong Race'); await A.fill('#ev-date', hoy); await A.click('#ev-form button[type=submit]'); await A.waitForTimeout(300);
  await go(A, '#hoy'); dc = await T(A, '#diet-card');
  ok('el día que compito, Hoy pasa solo a «Día de Competición» y enseña su pauta', /Automático: Día de Competición/.test(dc) && /No pruebes nada nuevo/.test(dc), dc);
  await A.click('#nut-card [data-plan-slot="ent"]'); await A.waitForTimeout(250); await A.click('#popt-body [data-log-opt]'); await A.waitForTimeout(400);
  ok('una opción sin cantidades no se inventa calorías: abre el formulario con el nombre puesto', await A.evaluate(() => document.querySelector('#sh-meal').open) && await A.inputValue('#f-name') === 'Bebida isotónica + plátano');
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);

  // ---- 4. Respuesta cortada y páginas que no se dejan leer
  await map({ '1-4': '{"by": "", "blocks": [{"pg": 2, "kind": "Días inten', '1-2': J([P2]), '3-4': J([P3, P4]), '5-7': 'no es json', '5-6': 'tampoco', '5': 'nada', '6': J([P6]), '7': J([P7], N7) });
  await go(A, '#datos'); await A.click('#diet-box [data-sheet="diet"]:not([data-up])'); await A.waitForTimeout(300);
  n0 = (await sent()).length; await A.setInputFiles('#dt-file', pdf); await read(A); S1 = (await sent()).slice(n0); L = await local(A);
  ok('si una respuesta llega cortada, parte la tanda en dos y no pierde nada', S1.some(x => /las páginas 1 a 2 de 7/.test(txt(x.body))) && S1.some(x => /las páginas 3 a 4 de 7/.test(txt(x.body))) && L.profile.diet.kinds[0].moms[0].opts.length === 2, String(S1.length));
  ok('la página que no se deja leer se reintenta una vez y se avisa de cuál falta', S1.filter(x => /la página 5 de 7/.test(txt(x.body))).length === 2 && /No he podido leer la página 5: lo que haya ahí no está en el plan/.test(await T(A, '#dt-msg')) && /2 tipos de día y 5 opciones/.test(await T(A, '#dt-msg')), await T(A, '#dt-msg'));
  await A.click('#dt-undo'); await A.waitForTimeout(300); L = await local(A);
  ok('«Deshacer» devuelve el plan anterior (el de 4 opciones)', L.profile.diet.kinds.reduce((a, k) => a + k.moms.reduce((x, m) => x + m.opts.length, 0), 0) === 4);

  // ---- 5. Una foto: plan de un solo día, cerrado → pasa a ser el objetivo
  const day = [['des', 'Desayuno', 'Tostadas con pavo', [col('Pan integral', 250, 9, 45, 3), col('Pavo', 105, 21, 1, 2)], ['80', '100']], ['com', 'Comida', 'Pollo con patata', [col('Pollo', 110, 23, 0, 2), col('Patata', 80, 2, 17, 0.1), col('Aceite de oliva', 900, 0, 0, 100)], ['120', '140', '10']], ['cen', 'Cena', 'Merluza con verduras', [col('Merluza', 80, 17, 0, 1.5), col('Verduras', 30, 2, 5, 0.3)], ['150', '300']]];
  await map({ '*': J(day.map((x, i) => ({ pg: 1, kind: '', slot: x[0], mom: x[1], opt: x[2], cols: x[3], rows: [['', 0, 0].concat(x[4])] })), [], 'Clara') });
  n0 = (await sent()).length; await A.setInputFiles('#dt-file', png); await read(A); S1 = (await sent()).slice(n0); L = await local(A);
  ok('de una foto: una sola petición con la imagen y un plan de un tipo de día', S1.length === 1 && imgs(S1[0].body).length === 1 && /la página 1 de 1/.test(txt(S1[0].body)) && L.profile.diet.kinds.length === 1 && L.profile.diet.kinds[0].n === 'Todos los días' && /1 tipo de día y 3 opciones/.test(await T(A, '#dt-msg')), await T(A, '#dt-msg'));
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  await A.click('.nav-side a[data-tab="comp"]'); await A.waitForTimeout(150); await A.click('[data-del-ev]'); await A.waitForTimeout(300); await go(A, '#hoy');
  const lab = await T(A, '#d-label'); dc = await T(A, '#diet-card');
  ok('un plan cerrado (unas 850 kcal) por debajo del gasto en reposo no se toma como objetivo sin pedirlo', !/Objetivo: tu plan pautado/.test(lab) && /puede que esté a medias/.test(dc) && /Por debajo/.test(dc), dc);
  await go(A, '#datos'); await A.click('#diet-box [data-sheet="diet"]:not([data-up])'); await A.waitForTimeout(300); await A.selectOption('#dt-goal', 'plan'); await A.waitForTimeout(300); await A.keyboard.press('Escape'); await A.waitForTimeout(200); await go(A, '#hoy');
  ok('si elijo «Siempre mi plan pautado», el objetivo del día es el plan y la app solo estima', /Objetivo: tu plan pautado/.test(await T(A, '#d-label')) && /La app estima para hoy unas \d+ kcal \(entre \d+ y \d+\)/.test(await T(A, '#d-label')) && /Cifras según tu plan pautado/.test(await T(A, '#d-falta')), await T(A, '#d-label'));
  await A.click('#nut-card [data-plan-slot="com"]'); await A.waitForTimeout(250); await A.click('#popt-body [data-log-opt]'); await A.waitForTimeout(400);
  ok('con una sola opción por comida también se apunta con un toque', /Pollo/.test(await T(A, '#d-meals')) && /Aceite de oliva/.test(await T(A, '#d-meals')));

  // ---- 6. Sincroniza y el entrenador lo ve sin romperse
  await settle(A, 3600); await C.click('#reload'); await C.waitForTimeout(500); await C.click('[data-see]'); await C.waitForSelector('#detail table', { timeout: 20000 });
  ok('el plan viaja a la nube y el panel del entrenador lo resume', /Plan pautado por Clara/.test(await T(C, '#detail')) && /1 tipo de día/.test(await T(C, '#detail')), (await T(C, '#detail')).slice(0, 400));
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')); fails++; } finally { await b.close(); srv.kill(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
