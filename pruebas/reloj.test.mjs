// Uso: node pruebas/reloj.test.mjs [ruta a index.html]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'; import os from 'node:os'; import path from 'node:path';
const HTML = path.resolve(process.argv[2] || 'index.html'), DAT = f => new URL('./datos/' + f, import.meta.url).pathname, SHOT = f => path.join(os.tmpdir(), f);
const b=await chromium.launch(); const errs=[]; const res=[]; let fails=0;
const ok=(name,cond,extra='')=>{res.push((cond?'OK   ':'FALLA ')+name+(extra?'  → '+extra:''));if(!cond)fails++;};
const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage();
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
const T=async sel=>(await p.textContent(sel)).replace(/\s+/g,' ').trim(); const wait=ms=>p.waitForTimeout(ms);
await p.clock.setFixedTime(new Date('2026-10-02T15:00:00'));
await p.goto('file://'+HTML); await p.evaluate(()=>localStorage.clear()); await p.reload(); await wait(300);
await p.click('#v-need a'); await wait(200);
await p.fill('#p-name','Marco'); await p.fill('#p-age','35'); await p.fill('#p-height','167'); await p.fill('#p-weight','73'); await p.selectOption('#p-plan','dia');
await p.click('#p-form button[type=submit]'); await wait(400);
const kmVis=()=>p.isVisible('#a-km'); const open=async()=>{ await p.click('#train-card [data-sheet="act"]'); await wait(250); };
const vals=async()=>({type:await p.inputValue('#a-type'),min:await p.inputValue('#a-min'),km:await p.inputValue('#a-km'),hr:await p.inputValue('#a-hr'),kcal:await p.inputValue('#a-kcal')});
// distancia según deporte
await open();
ok('sin plan: carrera por defecto, con distancia', (await p.inputValue('#a-type'))==='carrera' && await kmVis());
await p.fill('#a-km','8'); await p.selectOption('#a-type','fuerza'); await wait(100);
ok('fuerza: sin campo de distancia y valor borrado', !(await kmVis()) && (await p.inputValue('#a-km'))==='');
for (const [t,v] of [['crossfit',false],['funcional',false],['krav',false],['movilidad',false],['natacion',false],['series',true],['hibrido',true],['bici',true],['patines',true],['competicion',true]]){ await p.selectOption('#a-type',t); await wait(60); ok('distancia en '+t+': '+(v?'sí':'no'), (await kmVis())===v); }
// FIT de fuerza
await p.setInputFiles('#a-gpx',DAT('test-fuerza.fit')); await wait(500);
let v=await vals(); ok('FIT fuerza: tipo fuerza, 55 min, 118 ppm, 412 kcal, sin km', v.type==='fuerza'&&v.min==='55'&&v.hr==='118'&&v.kcal==='412'&&!(await kmVis()), JSON.stringify(v)+' | '+await T('#a-msg'));
await p.click('#act-form button[type=submit]'); await wait(300);
ok('FIT fuerza guardado: del reloj, sin km', /del reloj/.test(await T('#d-sess .acts')) && !/km/.test(await T('#d-sess .acts')), await T('#d-sess .acts'));
ok('gasto usa las kcal del reloj (412)', /412/.test(await T('#d-sess')), await T('#d-sess'));
// reabrir: se queda en fuerza y sin distancia
await open(); ok('al reabrir no aparece la distancia de la vez anterior', (await p.inputValue('#a-km'))==='');
// FIT de carrera
await p.setInputFiles('#a-gpx',DAT('test-carrera.fit')); await wait(500); v=await vals();
ok('FIT carrera: carrera, 45 min, 8,23 km, 152 ppm, 590 kcal', v.type==='carrera'&&v.min==='45'&&v.km==='8,23'&&v.hr==='152'&&v.kcal==='590'&&await kmVis(), JSON.stringify(v));
await p.keyboard.press('Escape'); await wait(150);
// ZIP de Garmin
await open(); await p.setInputFiles('#a-gpx',DAT('test-garmin.zip')); await wait(700); v=await vals();
ok('ZIP de Garmin (FIT dentro): mismos datos', v.type==='carrera'&&v.min==='45'&&v.km==='8,23'&&v.kcal==='590', JSON.stringify(v)+' | '+await T('#a-msg'));
// TCX de fuerza (Sport=Other), con el día planificado en crossfit
await p.keyboard.press('Escape'); await wait(150);
await p.evaluate(()=>{['#a-min','#a-km','#a-kcal','#a-hr'].forEach(i=>document.querySelector(i).value='')});
await p.click('[data-sheet="plan"]'); await wait(200); await p.selectOption('#sh-plan-body select','crossfit'); await wait(250); await p.click('#sh-plan [data-close].btn'); await wait(200);
await open(); ok('abre con el deporte previsto (crossfit) y sin distancia', (await p.inputValue('#a-type'))==='crossfit' && !(await kmVis()));
await p.setInputFiles('#a-gpx',DAT('test-fuerza.tcx')); await wait(500); v=await vals();
ok('TCX: 55 min, 400 kcal, pulso 117 (ponderado), tipo previsto, sin km', v.type==='crossfit'&&v.min==='55'&&v.kcal==='400'&&v.hr==='117'&&!(await kmVis()), JSON.stringify(v)+' | '+await T('#a-msg'));
await p.click('#act-form button[type=submit]'); await wait(300);
ok('TCX guardado', await p.locator('#d-sess .acts li').count()===2, await T('#d-sess .acts'));
// GPX sigue igual
await open(); await p.setInputFiles('#a-gpx',DAT('test.gpx')); await wait(500); v=await vals();
ok('GPX como antes: 5,14 km, 26 min, 150 ppm', v.type==='carrera'&&v.km==='5,14'&&v.min==='26'&&v.hr==='150'&&await kmVis(), JSON.stringify(v)+' | '+await T('#a-msg'));
await p.click('#act-form button[type=submit]'); await wait(300); ok('GPX guardado como de GPX', /de GPX/.test(await T('#d-sess .acts')));
// archivo que no vale
await open(); await p.setInputFiles('#a-gpx',{name:'foto.jpg',mimeType:'image/jpeg',buffer:Buffer.from('no soy una actividad')}); await wait(400);
ok('archivo no válido: aviso claro y hoja abierta', /No he podido leer/.test(await T('#a-msg')) && await p.evaluate(()=>document.querySelector('#sh-act').open), await T('#a-msg'));
await p.screenshot({path:SHOT('f3-act-crossfit.png')}); await p.keyboard.press('Escape');
// persistencia
await p.reload(); await wait(500); ok('persisten los 3 entrenos', await p.locator('#d-sess .acts li').count()===3, await T('#d-sess .acts'));
await p.setViewportSize({width:400,height:860}); await wait(300); await p.click('.fab'); await wait(250); await p.click('[data-quick="act"]'); await wait(300); await p.click('.how summary'); await wait(200); await p.screenshot({path:SHOT('f3-movil-act.png')});
console.log(res.join('\n')); console.log('\n'+(res.length-fails)+' de '+res.length+' pruebas bien'); console.log(errs.length?[...new Set(errs)].join('\n'):'sin errores de script');
await b.close();
