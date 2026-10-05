// Varios ingredientes por comida, plan pautado frente al entreno del día y recordatorios para el calendario.
// Uso: node pruebas/plan.test.mjs [ruta a index.html]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'; import path from 'node:path'; import fs from 'node:fs';
const HTML = path.resolve(process.argv[2] || 'index.html');
const b = await chromium.launch(); const errs = []; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'OK    ' : 'FALLA ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }), p = await ctx.newPage(); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
const T = async sel => (await p.textContent(sel)).replace(/\s+/g, ' ').trim(), wait = ms => p.waitForTimeout(ms), go = async h => { await p.evaluate(x => { location.hash = x; }, h); await wait(250); };
const open = id => p.evaluate(x => document.querySelector(x).open, id);
const food = async (name, g) => { await p.fill('#f-name', name); await p.fill('#f-g', String(g)); await wait(100); };
const prof = () => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('platoypista:v1:u:')))).profile);
try {
  await p.goto('file://' + HTML); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(300);
  await p.click('#v-need a'); await wait(200); await p.fill('#p-name', 'Tania'); await p.fill('#p-age', '35'); await p.fill('#p-height', '167'); await p.fill('#p-weight', '73'); await p.selectOption('#p-plan', 'dia'); await p.click('#p-form button[type=submit]'); await wait(400);
  // --- varios ingredientes en una comida
  ok('cada momento del día tiene su botón +', await p.locator('#d-meals [data-add-slot]').count() === 4);
  await p.click('#d-meals [data-add-slot="des"]'); await wait(250);
  ok('el + del desayuno abre la hoja ya en Desayuno y con los campos a la vista', await open('#sh-meal') && (await p.inputValue('#f-slot')) === 'des' && await p.isVisible('#f-name'));
  await food('Arroz blanco cocido', 200); await p.click('#f-more'); await wait(300);
  ok('«+ Añadir otro»: guarda, sigue abierta y enseña lo que llevas', await open('#sh-meal') && /Arroz blanco cocido/.test(await T('#f-list')) && /Suma: 260 kcal/.test(await T('#f-list')) && (await p.inputValue('#f-name')) === '', await T('#f-list'));
  await food('Patata cocida', 250); await p.click('#f-submit'); await wait(300);
  ok('al añadir el segundo se cierra y el desayuno suma 478 kcal', !(await open('#sh-meal')) && /Desayuno\s*478 kcal/.test(await T('#d-meals .slots')) && /478/.test(await T('#d-label .kv')), await T('#d-meals .slots'));
  const wasOpen = await p.evaluate(() => document.querySelector('#d-meals details[data-slot="des"]').open);
  await p.click('#d-meals details[data-slot="des"] [data-add-slot]'); await wait(250);
  ok('el + de un momento con comidas no pliega ni despliega la lista', (await p.evaluate(() => document.querySelector('#d-meals details[data-slot="des"]').open)) === wasOpen && await open('#sh-meal'));
  ok('la hoja enseña los dos ingredientes y la suma', (await p.locator('#f-list li').count()) === 2 && /Suma: 478 kcal/.test(await T('#f-list')));
  await food('Huevo', 60); await p.click('#f-more'); await wait(250); await p.click('#f-submit'); await wait(300);
  ok('tras «+ Añadir otro», «Añadir» sin nada más solo cierra', !(await open('#sh-meal')) && (await p.locator('#d-meals details[data-slot="des"] .meals li').count()) === 3, await T('#d-meals .slots'));
  await p.click('#d-meals [data-add-slot="cen"]'); await wait(250); await p.click('#f-submit'); await wait(200);
  ok('sin nada escrito y sin haber añadido: avisa', await open('#sh-meal') && /Pon qué es/.test(await T('#f-msg'))); await p.keyboard.press('Escape'); await wait(200);
  const kc0 = await T('#d-label .kv');
  // --- plan pautado
  ok('sin plan, Hoy invita a añadirlo y no hay tarjeta de plan', await p.isVisible('#nut-card .linkbtn') && !(await p.isVisible('#diet-card')));
  await p.click('#nut-card .linkbtn'); await wait(250); ok('se abre la hoja del plan', await open('#sh-diet'));
  await p.click('#sh-diet [data-add-slot="des"]'); await wait(300);
  ok('añadir al plan: hoja en modo plan, sin foto ni IA', await open('#sh-meal') && (await T('#sh-meal-t')) === 'Añadir al plan' && !(await p.isVisible('#f-choices')));
  await food('Arroz blanco cocido', 200); await p.click('#f-more'); await wait(250); await food('Patata cocida', 250); await p.click('#f-submit'); await wait(500);
  ok('vuelve al plan con el desayuno pautado (478 kcal)', await open('#sh-diet') && !(await open('#sh-meal')) && /Desayuno\s*478 kcal/.test(await T('#diet-body')) && /Total del plan: 478 kcal/.test(await T('#diet-body')), await T('#diet-body'));
  await p.click('#sh-diet [data-add-slot="com"]'); await wait(300); await food('Pechuga de pollo a la plancha', 150); await p.click('#f-submit'); await wait(500);
  await p.fill('#dt-by', 'Clara'); await p.dispatchEvent('#dt-by', 'change'); await wait(250); await p.click('#sh-diet [data-close].btn'); await wait(250);
  ok('montar el plan no cambia lo comido hoy', (await T('#d-label .kv')) === kc0);
  let dc = await T('#diet-card');
  ok('Hoy: plan 726 kcal frente a 1732 del día → se queda corto 1006', await p.isVisible('#diet-card') && /Se queda corto/.test(dc) && /726/.test(dc) && /1732/.test(dc) && /−1006/.test(dc) && /un día sin entreno/.test(dc) && /Clara/.test(dc), dc);
  ok('el momento vacío con plan ofrece «Apuntar lo pautado»', await p.isVisible('#d-meals [data-log-plan="com"]') && !(await p.$('#d-meals [data-log-plan="des"]')));
  await p.click('#d-meals [data-log-plan="com"]'); await wait(300);
  ok('apuntar lo pautado: la comida entra con 248 kcal', /Comida\s*248 kcal/.test(await T('#d-meals .slots')), await T('#d-meals .slots'));
  // solo totales
  await p.click('#diet-card [data-sheet="diet"]'); await wait(250); await p.click('#dt-clear'); await wait(300);
  ok('quitar el plan: desaparece la tarjeta', !(await p.isVisible('#diet-card')) && !(await prof()).diet);
  await p.click('#nut-card .linkbtn'); await wait(250); await p.click('#sh-diet details.how summary'); await wait(150);
  await p.fill('#dt-kcal', '1700'); await p.fill('#dt-p', '140'); await p.fill('#dt-c', '180'); await p.fill('#dt-f', '50'); await p.click('#dt-save'); await wait(300); await p.click('#sh-diet [data-close].btn'); await wait(250);
  dc = await T('#diet-card'); ok('plan solo con totales (1700): encaja con un día de 1732', /Encaja/.test(dc) && /1700/.test(dc), dc);
  await p.click('#train-card [data-sheet="plan"]'); await wait(200); await p.selectOption('#sh-plan-body select', 'crossfit'); await wait(250); await p.click('#sh-plan [data-close].btn'); await wait(250);
  dc = await T('#diet-card'); ok('con crossfit de 60′ el día pide 2141: el mismo plan se queda corto 441, sobre todo en hidratos', /Se queda corto/.test(dc) && /crossfit de 60′/.test(dc) && /441 kcal/.test(dc) && /hidratos/.test(dc), dc);
  await p.click('#train-card [data-sheet="act"]'); await wait(200); await p.fill('#a-min', '60'); await p.fill('#a-kcal', '900'); await p.click('#act-form button[type=submit]'); await wait(300);
  dc = await T('#diet-card'); ok('con el entreno ya hecho compara con lo entrenado de verdad', /lo que has entrenado/.test(dc), dc);
  await go('#datos'); await p.fill('#p-weight', '72'); await p.click('#p-form button[type=submit]'); await wait(400);
  ok('guardar el perfil no borra el plan', ((await prof()).diet || {}).tot.kcal === 1700 && /1700 kcal/.test(await T('#diet-box')));
  // --- recordatorios
  await go('#datos'); await p.click('[data-rem-defaults]'); await wait(300);
  const links = await p.$$eval('#rem-box .rems a', a => a.map(x => x.href));
  const u0 = new URL(links[0]);
  ok('«Proponer los habituales»: 7 avisos, cada uno con su enlace a Google Calendar', links.length === 7 && links.every(h => h.startsWith('https://calendar.google.com/calendar/render?')), links.length + '');
  ok('el enlace lleva título, hora y repetición diaria', u0.searchParams.get('action') === 'TEMPLATE' && u0.searchParams.get('text') === 'Desayuno' && /^\d{8}T080000\/\d{8}T081000$/.test(u0.searchParams.get('dates')) && u0.searchParams.get('recur') === 'RRULE:FREQ=DAILY', links[0]);
  await p.click('#rem-box [data-sheet="rem"]'); await wait(250); await p.selectOption('#r-kind', 'med'); await wait(100);
  ok('medicación: texto por defecto y aviso de que no se sube', (await p.inputValue('#r-title')) === 'Medicación' && /no se sube a la nube/.test(await T('#r-note')));
  await p.fill('#r-time', '09:30'); await p.selectOption('#r-days', 'lv'); await p.click('#rem-form button[type=submit]'); await wait(300);
  let pr = await prof(); const medLink = await p.$$eval('#rem-box .rems li', li => li.filter(x => /Medicación/.test(x.textContent)).map(x => x.querySelector('a').href)[0]);
  ok('el de medicación se guarda aparte y su enlace repite de lunes a viernes', pr.rem.length === 7 && pr.medrem.length === 1 && pr.medrem[0].time === '09:30' && new URL(medLink).searchParams.get('recur') === 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', medLink);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#rem-ics')]); const ics = fs.readFileSync(await dl.path(), 'utf8');
  ok('archivo .ics con los 8 avisos, repetición y alarma a su hora', (ics.match(/BEGIN:VEVENT/g) || []).length === 8 && /RRULE:FREQ=DAILY/.test(ics) && /BYDAY=MO,TU,WE,TH,FR/.test(ics) && /TRIGGER:PT0M/.test(ics) && /SUMMARY:Beber agua/.test(ics) && /DTSTART:\d{8}T093000/.test(ics) && ics.includes('\r\n'));
  await p.locator('#rem-box [data-del-rem]').first().click(); await wait(300);
  ok('quitar un recordatorio', (await p.locator('#rem-box .rems li').count()) === 7);
  await p.fill('#p-weight', '71'); await p.click('#p-form button[type=submit]'); await wait(400); pr = await prof();
  ok('guardar el perfil no borra los recordatorios', pr.rem.length === 6 && pr.medrem.length === 1 && pr.weight === 71);
  await p.reload(); await wait(500); await go('#datos');
  ok('tras recargar siguen el plan y los recordatorios', /1700 kcal/.test(await T('#diet-box')) && (await p.locator('#rem-box .rems li').count()) === 7);
  await p.setViewportSize({ width: 400, height: 860 }); await go('#hoy'); await wait(300);
  ok('móvil: sin desborde lateral con la tarjeta del plan', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  if (process.env.SHOTS) { await p.screenshot({ path: path.join(process.env.SHOTS, 'pl-hoy.png'), fullPage: true }); await p.click('#d-meals [data-add-slot="des"]'); await wait(300); await p.screenshot({ path: path.join(process.env.SHOTS, 'pl-comida.png') }); await p.keyboard.press('Escape'); await go('#datos'); await p.locator('#rem-box').scrollIntoViewIfNeeded(); await wait(200); await p.screenshot({ path: path.join(process.env.SHOTS, 'pl-rem.png') }); await p.click('#diet-box [data-sheet="diet"]'); await wait(300); await p.screenshot({ path: path.join(process.env.SHOTS, 'pl-plan.png') }); }
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')); fails++; } finally { await b.close(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
