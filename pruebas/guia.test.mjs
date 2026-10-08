// Guía personal: primero pregunta cómo estás, luego el día paso a paso; tres formas de entrenar; plan para quien empieza; foto de la pizarra y planificación con el asistente.
// Uso: node pruebas/guia.test.mjs <carpeta construida con ELITEPRO_NUBE_URL=/api>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const dir = process.argv[2], port = 8795, base = 'http://localhost:' + port;
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
const ai = q => get('/__ai?' + q), sent = async () => (await dump()).stats.ai;
const png = dir + '/_pizarra.png'; fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const now = new Date(), t0 = iso(now), dw = (now.getDay() + 6) % 7, mon = new Date(now); mon.setDate(now.getDate() - dw); const monday = iso(mon), tm = new Date(now); tm.setDate(now.getDate() + 1); const tomorrow = iso(tm);
try {
  const C = await mk(); await C.goto(base + '/panel.html'); await C.waitForSelector('#v-setup:not([hidden])'); await C.fill('#s-code', await get('/__setup')); await C.fill('#s-pass', 'entrenador-clave-1'); await C.fill('#s-pass2', 'entrenador-clave-1'); await C.click('#f-setup button[type=submit]'); await C.waitForSelector('#v-app:not([hidden])', { timeout: 30000 });
  await C.click('#inv-new'); await C.waitForTimeout(500); const codes = await C.$$eval('#invites code', e => e.map(x => x.textContent));
  const A = await mk(); await A.goto(base + '/'); await A.waitForTimeout(400); await A.click('#v-need a'); await A.waitForTimeout(200);
  await A.fill('#p-name', 'Tania Ruiz'); await A.selectOption('#p-sex', 'f'); await A.fill('#p-age', '40'); await A.fill('#p-height', '160'); await A.fill('#p-weight', '60'); await A.selectOption('#p-plan', 'dia'); await A.click('#p-form button[type=submit]'); await A.waitForTimeout(400);

  // ---- 1. Lo primero: saluda por el nombre y pregunta cómo estás
  await go(A, '#hoy'); let g = await T(A, '#guide-card');
  ok('nada más entrar saluda por el nombre y pregunta cómo estás antes de mandar nada', await A.isVisible('#guide-card') && /(Buenos días|Buenas tardes|Buenas noches), Tania\./.test(g) && /¿cómo te encuentras hoy\?/.test(g) && (await A.locator('#guide-card [data-feel]').count()) === 5 && !(await A.isVisible('#guide-card .gsteps2')), g);
  ok('a quien empieza le da la bienvenida, sin reproches', /Me alegra que empieces/.test(g));
  await A.click('#guide-card [data-feel="ok"]'); await A.waitForTimeout(300); g = await T(A, '#guide-card');
  ok('al contestar, responde y enseña el día paso a paso (desayuno, entreno, comida, cena, peso)', /Paso a paso/.test(g) && (await A.locator('#guide-card .gsteps2 li').count()) === 5 && /Desayuno/.test(g) && /Cena/.test(g) && /Peso/.test(g) && (await local(A)).days[t0].feel === 'ok', g);
  ok('sin saber cómo entrena, se ofrece a organizarle los entrenos', /¿Te organizo los entrenos\?/.test(g) && await A.isVisible('#guide-card [data-sheet="start"]'));
  ok('en otro día no sale la guía de hoy', await (async () => { await A.click('[data-go="-1"]'); await A.waitForTimeout(200); const v = await A.isVisible('#guide-card'); await A.click('[data-go="0"]'); await A.waitForTimeout(200); return !v; })());

  // ---- 2. Box: días y tipo de clase; cansada → afloja
  await A.click('#guide-card [data-sheet="start"]'); await A.waitForTimeout(250);
  ok('pregunta cómo entrenas con tres caminos', (await A.locator('#start-body [data-st-go]').count()) === 3 && /Estoy empezando/.test(await T(A, '#start-body')) && /box/.test(await T(A, '#start-body')));
  await A.click('[data-st-go="box"]'); await A.waitForTimeout(200); await A.click('[data-st="kind:hibrido"]'); for (let i = 0; i < 7; i++) await A.click(`[data-st-day="${i}"]`); await A.click('[data-st-save="box"]'); await A.waitForTimeout(400);
  let L = await local(A); g = await T(A, '#guide-card');
  ok('box: deja la semana puesta (híbrido 60′ todos los días) y hoy toca entrenar', L.profile.mode === 'box' && L.profile.plan === 'fija' && L.profile.week.every(x => x.type === 'hibrido' && x.min === 60) && /Híbrido \/ Hyrox/.test(g) && await A.isVisible('#guide-card [data-done-sess]'), g);
  await A.click('#guide-card [data-feel=""]'); await A.waitForTimeout(200); await A.click('#guide-card [data-feel="low"]'); await A.waitForTimeout(300); g = await T(A, '#guide-card');
  ok('si digo que estoy cansada, se interesa y propone aflojar', /Gracias por decírmelo/.test(g) && /cuidarse/.test(g) && /no recortes comida/.test(g) && await A.isVisible('#guide-card [data-soft]'), g);
  await A.click('#guide-card [data-soft]'); await A.waitForTimeout(300); L = await local(A);
  ok('…y con un toque cambia el día a movilidad suave de 30′', L.days[t0].session.type === 'movilidad' && L.days[t0].session.min === 30 && /Movilidad/.test(await T(A, '#guide-card')));
  await A.click('#guide-card [data-feel=""]'); await A.waitForTimeout(200); await A.click('#guide-card [data-feel="pain"]'); await A.waitForTimeout(300); g = await T(A, '#guide-card');
  ok('con molestias: lo primero la persona, y manda al fisio o al médico si no se pasa', /Lo primero eres tú/.test(g) && /fisio o un médico/.test(g) && await A.isVisible('#guide-card [data-goto="inj-box"]'), g);
  await A.click('#guide-card [data-done-sess]'); await A.waitForTimeout(300); let wb = await T(A, '#wod-body');
  ok('«Lo he hecho» abre el registro: primero pregunta si lo hizo completo', await A.evaluate(() => document.querySelector('#sh-wod').open) && /Paso 1 de 3/.test(wb) && /¿Lo hiciste completo\?/.test(wb), wb);
  await A.click('[data-wz-full="1"]'); await A.waitForTimeout(150); wb = await T(A, '#wod-body');
  ok('luego el tiempo, con la duración prevista ya puesta', /Paso 2 de 3/.test(wb) && await A.inputValue('#wz-min') === '30');
  await A.fill('#wz-min', '35'); await A.click('[data-wz-next="with"]'); await A.waitForTimeout(150);
  ok('y luego si fue solo o en pareja (sin elegir no deja guardar)', /Paso 3 de 3/.test(await T(A, '#wod-body')) && await A.isDisabled('[data-wz-save]'));
  await A.click('[data-wz-with="pareja"]'); await A.waitForTimeout(150); await A.fill('#wz-mate', 'Bacilio'); await A.click('[data-wz-save]'); await A.waitForTimeout(300); L = await local(A); g = await T(A, '#guide-card');
  ok('se guarda completo, con su tiempo y en pareja, y lo celebra', L.days[t0].acts.length === 1 && L.days[t0].acts[0].type === 'movilidad' && L.days[t0].acts[0].min === 35 && L.days[t0].acts[0].full === true && L.days[t0].acts[0].with === 'pareja' && L.days[t0].acts[0].mate === 'Bacilio' && /Buen trabajo/.test(g) && /completo · en pareja con Bacilio/.test(await T(A, '#d-sess')), JSON.stringify(L.days[t0].acts));

  // ---- 3. Quien empieza: plan «Híbrido desde cero»
  await A.click('#guide-card [data-sheet="start"]'); await A.waitForTimeout(250); await A.click('[data-st-go="guia"]'); await A.waitForTimeout(200);
  ok('el plan para empezar pregunta días y punto de partida y avisa de consultar al médico', /¿Cuántos días puedes entrenar\?/.test(await T(A, '#start-body')) && /¿De dónde partes\?/.test(await T(A, '#start-body')) && /coméntalo antes con tu médico/.test(await T(A, '#start-body')));
  await A.click('[data-st="n:4"]'); await A.click('[data-st="lvl:0"]'); await A.click('[data-st-save="guia"]'); await A.waitForTimeout(400); L = await local(A);
  ok('guarda el plan de 4 días empezando esta semana', L.profile.mode === 'guia' && L.profile.guide.n === 4 && L.profile.guide.lvl === 0 && L.profile.guide.start === monday, JSON.stringify(L.profile.guide));
  await go(A, '#semana'); await A.click('[data-wk="7"]'); await A.waitForTimeout(200); const wl = await T(A, '#wk-list');
  ok('la semana queda montada: fuerza A, correr y andar, fuerza B e híbrido, con sus descansos', /Lunes \d+\s*Fuerza A/.test(wl) && /Martes \d+\s*Correr y andar/.test(wl) && /Miércoles \d+\s*Descanso/.test(wl) && /Jueves \d+\s*Fuerza B/.test(wl) && /Sábado \d+\s*Híbrido/.test(wl) && /Domingo \d+\s*Descanso/.test(wl), wl.slice(0, 600));
  await A.click('#wk-list li:nth-child(1) [data-open]'); await A.waitForTimeout(300); await A.click('#train-card [data-sess]'); await A.waitForTimeout(250); let sb = await T(A, '#sess-body');
  ok('cada sesión viene explicada: calentamiento, circuito, vuelta a la calma y cómo de fuerte', /Calentamiento/.test(sb) && /2 vueltas de 12 repeticiones/.test(sb) && /Sentadilla a un banco/.test(sb) && /Vuelta a la calma/.test(sb) && /Cómo de fuerte/.test(sb) && /semana 2 de tu plan/.test(sb) && /mareo o presión en el pecho/.test(sb), sb.slice(0, 500));
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  // la progresión: el martes de las semanas 2, 3 y 8
  const runTxt = async n => { await go(A, '#semana'); await A.click('[data-wk="0"]').catch(() => {}); await A.waitForTimeout(120); for (let i = 0; i < n; i++) { await A.click('[data-wk="7"]'); await A.waitForTimeout(120); } await A.click('#wk-list li:nth-child(2) [data-open]'); await A.waitForTimeout(250); await A.click('#train-card [data-sess]'); await A.waitForTimeout(200); const t = await T(A, '#sess-body'); await A.keyboard.press('Escape'); await A.waitForTimeout(150); return t; };
  const r2 = await runTxt(1), r3 = await runTxt(2), r8 = await runTxt(7);
  ok('la carrera progresa semana a semana (1′30″ trotando → 3′ → 20′ seguidos)', /8 veces: 1′30″ trotando \+ 2′ andando/.test(r2) && /6 veces: 3′ trotando/.test(r3) && /20′ seguidos, muy suaves/.test(r8) && /semana 8 de tu plan \(descarga\)/.test(r8), r2.slice(0, 200) + ' | ' + r8.slice(0, 200));
  await A.click('#train-card [data-sheet="plan"]'); await A.waitForTimeout(200); await A.selectOption('#sh-plan-body select', 'bici'); await A.waitForTimeout(250);
  ok('un día del plan se puede cambiar por otro entreno y volver a lo que marca el plan', /Bici/.test(await T(A, '#d-sess')) && await A.isVisible('#sh-plan [data-guide-back]'));
  await A.click('#sh-plan [data-guide-back]'); await A.waitForTimeout(300); ok('…y al volver, vuelve la sesión de la guía', /Correr y andar/.test(await T(A, '#d-sess')));

  // ---- 4. Con cuenta e IA: foto de la pizarra y planificar con el asistente
  await ai('key=sk-prueba-9'); await A.click('[data-go="0"]'); await A.waitForTimeout(200);
  await go(A, '#datos'); await A.click('#cloud-card [data-cl="register"]'); await A.waitForTimeout(200); await A.fill('#cl-email', 'tania@ejemplo.com'); await A.fill('#cl-pass', 'clave-de-tania-1'); await A.fill('#cl-pass2', 'clave-de-tania-1'); await A.fill('#cl-inv', codes[0]); await A.check('#cl-terms'); await A.click('#cl-go'); await closed(A); await settle(A);
  await go(A, '#hoy'); await A.click(`[data-go="1"]`); await A.waitForTimeout(200); await A.click('[data-go="0"]'); await A.waitForTimeout(200);
  // se pasa a «solo» para que hoy quede por decidir y pida la pizarra
  await A.click('#guide-card [data-sheet="start"]'); await A.waitForTimeout(250); await A.click('[data-st-go="solo"]'); await A.waitForTimeout(150); await A.click('[data-st-save="solo"]'); await A.waitForTimeout(300);
  await A.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('platoypista:v1:u:')); }); L = await local(A);
  ok('«por mi cuenta» quita el plan de la guía y deja la planificación como estaba', L.profile.mode === 'solo' && !L.profile.guide);
  await ai('text=' + encodeURIComponent(JSON.stringify({ tipo: 'hibrido', min: 55, titulo: 'Simulación Hyrox', partes: ['Calentamiento: 10′ remo suave', 'Fuerza: 5×5 sentadilla', 'WOD: 4 rondas de 800 m + 20 wall balls'], explica: 'Trabajo de resistencia con fuerza. Sal conservador en la primera ronda.' })));
  await A.click('#d-sess [data-del-act]'); await A.waitForTimeout(300);
  const hasWod = await A.locator('#train-card .wod-file').count();
  ok('con la IA encendida, el entreno de hoy ofrece «Foto de la pizarra»', hasWod === 1 || (await A.locator('#guide-card .wod-file').count()) === 1);
  let n0 = (await sent()).length; await A.setInputFiles((await A.locator('#guide-card .wod-file').count()) ? '#guide-card .wod-file' : '#train-card .wod-file', png);
  await A.waitForSelector('#ai-ok[open]', { timeout: 30000 }); await A.click('#ai-ok-yes'); await A.waitForFunction(d => { try { const o = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('platoypista:v1:u:')))); return o.days[d].session && o.days[d].session.src === 'foto'; } catch (e) { return false; } }, t0, { timeout: 30000 });
  L = await local(A); const ss = L.days[t0].session, S1 = (await sent()).slice(n0);
  ok('la pizarra se lee de la foto y deja la sesión de hoy con sus partes y un consejo', ss.type === 'hibrido' && ss.min === 55 && ss.title === 'Simulación Hyrox' && /WOD: 4 rondas/.test(ss.note) && /conservador/.test(ss.tip) && S1.length === 1 && S1[0].body.messages[0].content[0].type === 'image' && /pizarra de un box/.test(JSON.stringify(S1[0].body)), JSON.stringify(ss));
  ok('…y Hoy la enseña y ajusta el objetivo al entreno', /Simulación Hyrox/i.test(await T(A, '#d-sess')) && /Fuerza: 5×5 sentadilla/.test(await T(A, '#d-sess')) && /55/.test(await T(A, '#d-sess')));
  await A.click('#guide-card [data-done-sess]'); await A.waitForTimeout(300);
  ok('al registrarla salen las partes de la pizarra', /WOD: 4 rondas de 800 m \+ 20 wall balls/.test(await T(A, '#wod-body')));
  await A.click('[data-wz-full="0"]'); await A.waitForTimeout(150);
  ok('«Lo cambié» deja corregir cada parte y desmarcar lo que no hizo', (await A.locator('#wod-body [data-wz-t]').count()) === 3 && (await A.locator('#wod-body [data-wz-ok]:checked').count()) === 3);
  await A.fill('#wod-body [data-wz-t="2"]', 'WOD: 3 rondas de 800 m + 20 wall balls'); await A.uncheck('#wod-body [data-wz-ok="0"]'); await A.click('[data-wz-next="time"]'); await A.waitForTimeout(150);
  await A.fill('#wz-min', '50'); await A.fill('#wz-res', '21:30'); await A.click('[data-wz-next="with"]'); await A.waitForTimeout(150); await A.click('[data-wz-with="solo"]'); await A.waitForTimeout(100); await A.click('[data-wz-save]'); await A.waitForTimeout(300);
  let ac = (await local(A)).days[t0].acts[0];
  ok('queda apuntada como adaptada, con lo que cambió, su tiempo y su resultado', ac.title === 'Simulación Hyrox' && ac.type === 'hibrido' && ac.full === false && ac.min === 50 && ac.res === '21:30' && !ac.with && ac.parts[0].ok === false && ac.parts[2].t === 'WOD: 3 rondas de 800 m + 20 wall balls' && /adaptado · resultado 21:30/.test(await T(A, '#d-sess')), JSON.stringify(ac));
  // asistente: planifica mañana y se puede deshacer
  await ai('text=' + encodeURIComponent(JSON.stringify({ reply: 'Hecho, Tania: mañana rodaje suave de 40 minutos. ¿Cómo vas de piernas?', actions: [{ type: 'plan', sport: 'carrera', min: 40, title: 'Rodaje suave', date: tomorrow }] })));
  await A.click('.aibar'); await A.waitForTimeout(250);
  ok('el asistente abre preguntando cómo estás', /¿Cómo estás hoy\?/.test(await T(A, '#ai-log')) && /Hola, Tania/.test(await T(A, '#ai-log')));
  await A.fill('#ai-in', 'mañana quiero correr 40 minutos suave'); await A.keyboard.press('Enter'); await A.waitForFunction(() => /rodaje suave de 40/.test(document.querySelector('#ai-log').textContent), null, { timeout: 30000 });
  L = await local(A); const body = JSON.stringify((await sent()).at(-1).body);
  ok('el asistente deja puesto el entreno de mañana', L.days[tomorrow] && L.days[tomorrow].session.type === 'carrera' && L.days[tomorrow].session.min === 40 && L.days[tomorrow].session.title === 'Rodaje suave' && /Previsto/.test(await T(A, '#ai-log')), JSON.stringify(L.days[tomorrow]));
  ok('…y va informado: es motivador, sabe cómo entrena, la sesión de hoy y los próximos días', /motivador personal/.test(body) && /entrena por su cuenta/.test(body) && /Simulación Hyrox/.test(body) && /Próximos días/.test(body) && /\\"plan\\"/.test(body), body.slice(0, 300));
  ok('al asistente no se le manda cómo dice que se encuentra', !/"feel"|Con molestias|se encuentra cansad/.test(body));
  await A.click('#ai-log [data-ai-undo]'); await A.waitForTimeout(300); L = await local(A);
  ok('«Deshacer» quita lo planificado', !(L.days[tomorrow] && L.days[tomorrow].session));
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  // sin consentimiento de salud, «cómo estás» no sale del dispositivo
  await settle(A, 3600); const B2 = await mk(); await B2.goto(base + '/'); await B2.waitForTimeout(400); await B2.click('#cloud-card [data-cl="login"], [data-cl="login"]'); await B2.waitForTimeout(200); await B2.fill('#cl-email', 'tania@ejemplo.com'); await B2.fill('#cl-pass', 'clave-de-tania-1'); await B2.click('#cl-go'); await closed(B2); await settle(B2);
  const L2 = await local(B2);
  ok('en otro dispositivo llega el día (sesión y entreno) pero no «cómo estás»: es dato de salud', !!L2.days[t0] && L2.days[t0].acts.length === 1 && L2.days[t0].session.src === 'foto' && L2.days[t0].feel === undefined && (await local(A)).days[t0].feel === 'pain', JSON.stringify(L2.days[t0]));
  // foto directa desde «Registrar entreno»: cámara o galería → pasos
  await A.click('#train-card [data-sheet="act"]'); await A.waitForTimeout(250);
  ok('«Registrar entreno» ofrece hacer una foto con la cámara o elegirla', await A.locator('#sh-act .wz-file[capture="environment"]').count() === 1 && await A.isVisible('#sh-act .ai-img'));
  await ai('text=' + encodeURIComponent(JSON.stringify({ tipo: 'crossfit', min: 60, titulo: 'Murph light', partes: ['1 km carrera', '50 dominadas', '100 flexiones', '1 km carrera'], explica: 'Ve por partes.' })));
  await A.setInputFiles('#sh-act .wz-file[capture="environment"]', png); await A.waitForFunction(() => /Paso 1 de 3/.test((document.querySelector('#wod-body') || {}).textContent || ''), null, { timeout: 30000 });
  ok('la foto se lee y sigue con los pasos', /Murph light/.test(await T(A, '#sh-wod')) && /50 dominadas/.test(await T(A, '#wod-body')));
  await A.click('[data-wz-full="1"]'); await A.click('[data-wz-next="with"]'); await A.click('[data-wz-with="solo"]'); await A.click('[data-wz-save]'); await A.waitForTimeout(300);
  ac = (await local(A)).days[t0].acts.at(-1); ok('…y se guarda como un entreno completo de la foto', ac.title === 'Murph light' && ac.full === true && ac.src === 'foto' && ac.min === 60 && /de la foto · completo/.test(await T(A, '#d-sess')), JSON.stringify(ac));
  // a mano: también solo o en pareja
  await A.click('#train-card [data-sheet="act"]'); await A.waitForTimeout(250); await A.selectOption('#a-type', 'carrera'); await A.fill('#a-min', '30'); await A.fill('#a-km', '5'); await A.selectOption('#a-with', 'pareja'); await A.fill('#a-mate', 'Tania'); await A.click('#act-form button[type=submit]'); await A.waitForTimeout(300);
  ac = (await local(A)).days[t0].acts.at(-1); ok('el formulario a mano también guarda si fue en pareja', ac.type === 'carrera' && ac.with === 'pareja' && ac.mate === 'Tania');
} catch (e) { console.log('ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')); fails++; } finally { await b.close(); srv.kill(); }
console.log(errs.length ? [...new Set(errs)].join('\n') : 'sin errores de script'); console.log(fails ? '\n' + fails + ' fallos' : '\ntodo bien'); process.exit(fails ? 1 : 0);
