// Uso: node pruebas/app.test.mjs [ruta a index.html]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'; import os from 'node:os'; import path from 'node:path';
const HTML = path.resolve(process.argv[2] || 'index.html'), DAT = f => new URL('./datos/' + f, import.meta.url).pathname, SHOT = f => path.join(os.tmpdir(), f);
const b=await chromium.launch(); const errs=[]; const res=[]; let fails=0;
const ok=(name,cond,extra='')=>{res.push((cond?'OK   ':'FALLA ')+name+(extra?'  → '+extra:''));if(!cond)fails++;};
const url='file://'+HTML;
const ctx=await b.newContext({viewport:{width:1280,height:900},colorScheme:'light'}); const p=await ctx.newPage();
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|TUNNEL/.test(m.text()))errs.push('CONSOLE '+m.text())});
const T=async sel=>(await p.textContent(sel)).replace(/\s+/g,' ').trim();
const wait=ms=>p.waitForTimeout(ms);
const num=s=>Number(String(s).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'));
await p.goto(url); await p.evaluate(()=>localStorage.clear()); await p.reload(); await wait(300);
// 0. arranque en blanco → perfil
ok('arranque: pide datos', await p.isVisible('#v-need'));
await p.click('#v-need a'); await wait(200);
await p.fill('#p-name','Marco'); await p.fill('#p-age','35'); await p.fill('#p-height','167'); await p.fill('#p-weight','73'); await p.selectOption('#p-plan','dia');
await p.click('#p-form button[type=submit]'); await wait(400);
// 1. Hoy como panel
ok('Hoy: saludo con nombre', /Marco/.test(await T('#d-nav .hi')), await T('#d-nav'));
ok('Hoy: objetivo 1732 kcal (73 kg, 167 cm, 35 a, definir, sin entreno)', num(await T('.hero-goal b'))===1732, await T('.hero-goal'));
ok('Hoy: anillo presente', await p.locator('#d-label .ring-svg').count()===1);
ok('Hoy: 3 tarjetas de macros', await p.locator('#d-macros .mcard').count()===3, await T('#d-macros'));
ok('Hoy: proteína objetivo 146 g', /\/ 146 g/.test(await T('#d-macros .mcard:nth-child(1)')));
const visInputs=await p.evaluate(()=>[...document.querySelectorAll('#v-hoy input, #v-hoy select')].filter(e=>e.offsetParent!==null).length);
ok('Hoy: sin campos de formulario a la vista', visInputs===0, visInputs+' campos visibles');
// 2. navegación escritorio
for (const [tab,sel] of [['semana','#v-semana'],['progreso','#v-progreso'],['comp','#v-comp'],['datos','#v-datos'],['hoy','#v-hoy']]){ await p.click(`.nav-side a[data-tab="${tab}"]`); await wait(150); ok('navegación → '+tab, await p.isVisible(sel) && (await p.getAttribute(`.nav-side a[data-tab="${tab}"]`,'aria-current'))==='page'); }
ok('escritorio: barra lateral visible y barra inferior oculta', await p.isVisible('.nav-side') && !(await p.isVisible('.nav-bottom')));
// 3. elegir entreno previsto (hoja)
await p.click('[data-sheet="plan"]'); await wait(200);
ok('hoja de entreno previsto abierta', await p.evaluate(()=>document.querySelector('#sh-plan').open));
await p.selectOption('#sh-plan-body select','crossfit'); await wait(250);
await p.click('#sh-plan [data-close].btn'); await wait(200);
ok('cálculo: crossfit 60 min → 2141 kcal', num(await T('.hero-goal b'))===2141, await T('.hero-goal')+' | '+await T('#d-label .formula'));
ok('entreno: carga estimada Alta (511 kcal)', /Alta/.test(await T('#d-sess')), await T('#d-sess dl'));
// 4. añadir comida
await p.click('#nut-card [data-sheet="meal"]'); await wait(200);
ok('hoja de comida: opciones visibles y campos ocultos', await p.isVisible('#f-choices') && !(await p.isVisible('#f-fields')));
await p.click('#f-manual'); await wait(100);
await p.selectOption('#f-slot','com'); await p.fill('#f-name','Arroz blanco cocido'); await p.fill('#f-g','200'); await wait(100);
ok('comida: 200 g de arroz = 260 kcal', await p.inputValue('#f-kcal')==='260', await p.inputValue('#f-kcal'));
await p.click('#f-submit'); await wait(300);
ok('comida añadida: hoja cerrada', !(await p.evaluate(()=>document.querySelector('#sh-meal').open)));
ok('comida añadida: consumidas 260', /Consumidas ?260/.test(await T('#d-label .kv')), await T('#d-label .kv'));
ok('nutrición: Comida 260 kcal', /Comida.*260 kcal/.test(await T('#d-meals .slots')), await T('#d-meals .slots'));
// 5. editar comida
await p.click('#d-meals [data-edit-meal]'); await wait(200);
ok('editar: título y datos cargados', (await T('#sh-meal-t'))==='Editar comida' && await p.inputValue('#f-name')==='Arroz blanco cocido' && await p.inputValue('#f-g')==='200');
await p.fill('#f-g','300'); await wait(100); await p.click('#f-submit'); await wait(300);
ok('editar: ahora 390 kcal y sigue siendo una sola comida', /Consumidas ?390/.test(await T('#d-label .kv')) && await p.locator('#d-meals .meals li').count()===1, await T('#d-label .kv'));
// 6. buscar alimento → apuntar
await p.click('#nut-card [data-sheet="calc"]'); await wait(200); await p.fill('#c-q','patata cocida'); await p.fill('#c-g','250'); await wait(100);
await p.click('[data-use-food="Patata cocida"]'); await wait(250);
ok('calculadora → hoja de comida con 250 g de patata = 218 kcal', await p.evaluate(()=>document.querySelector('#sh-meal').open) && await p.inputValue('#f-kcal')==='218', await p.inputValue('#f-kcal'));
await p.selectOption('#f-slot','cen'); await p.click('#f-submit'); await wait(300);
ok('dos comidas apuntadas: 608 kcal', /Consumidas ?608/.test(await T('#d-label .kv')), await T('#d-label .kv'));
// 7. eliminar comida
await p.evaluate(()=>document.querySelectorAll('#d-meals details').forEach(d=>d.open=true)); await wait(100);
await p.locator('#d-meals [data-del-meal]').last().click(); await wait(300);
ok('eliminar comida: vuelve a 390', /Consumidas ?390/.test(await T('#d-label .kv')), await T('#d-label .kv'));
// 8. registrar entreno
await p.click('#train-card [data-sheet="act"]'); await wait(200);
await p.selectOption('#a-type','crossfit'); await p.fill('#a-min','50'); await p.fill('#a-hr','150'); await p.click('#act-form button[type=submit]'); await wait(300);
ok('entreno registrado: hecho y hoja cerrada', /Hecho/.test(await T('#d-sess')) && !(await p.evaluate(()=>document.querySelector('#sh-act').open)), await T('#d-sess .acts'));
// 9. importar GPX
await p.click('#train-card [data-sheet="act"]'); await wait(200);
await p.setInputFiles('#a-gpx', DAT('test.gpx')); await wait(400);
const km=num(await p.inputValue('#a-km')), mn=num(await p.inputValue('#a-min')), hr=await p.inputValue('#a-hr');
ok('GPX leído: ~5,14 km, 26 min, pulso 150', Math.abs(km-5.14)<0.05 && mn===26 && hr==='150', km+' km, '+mn+' min, '+hr+' ppm | '+await T('#a-msg'));
await p.click('#act-form button[type=submit]'); await wait(300);
ok('GPX guardado como entreno', /de GPX/.test(await T('#d-sess .acts')) && await p.locator('#d-sess .acts li').count()===2, await T('#d-sess .acts'));
// 10. registrar peso (hoy y ayer)
await p.click('#peso-card [data-sheet="peso"]'); await wait(200); await p.fill('#w-val','72,4'); await p.click('#w-form button[type=submit]'); await wait(300);
ok('peso registrado: 72,4 kg', /72,4/.test(await T('#d-peso')), await T('#d-peso'));
await p.click('[data-go="-1"]'); await wait(200); await p.click('#peso-card [data-sheet="peso"]'); await wait(200); await p.fill('#w-val','72,9'); await p.click('#w-form button[type=submit]'); await wait(300);
await p.click('[data-go="0"]'); await wait(200);
ok('peso: variación semanal −0,5 kg', /−0,5 kg esta semana/.test(await T('#d-peso')), await T('#d-peso'));
// 11. competición
await p.click('.nav-side a[data-tab="comp"]'); await wait(150); await p.click('#v-comp [data-sheet="ev"]'); await wait(200);
await p.fill('#ev-name','Strong Race Mallorca'); await p.fill('#ev-date','2026-11-08'); await p.click('#ev-form button[type=submit]'); await wait(300);
ok('competición añadida y cuenta atrás', /Strong Race Mallorca/.test(await T('#comp-hero')) && new RegExp(String(Math.round((new Date(2026, 10, 8) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000))).test(await T('#comp-hero')), await T('#comp-hero'));
await p.click('[data-target-ev]'); await wait(200); ok('competición marcada como objetivo', /Tu objetivo/.test(await T('#ev-list')));
// 12. semana
await p.click('.nav-side a[data-tab="semana"]'); await wait(200);
ok('semana: tira de 7 días e indicadores', await p.locator('#wk-strip .sday').count()===7 && await p.locator('#wk-strip .sday.today .dots i.on').count()>=2, await T('#wk-nav'));
ok('semana: 7 tarjetas y hoy completado', await p.locator('#wk-list .wcard').count()===7 && /Completado/.test(await T('#wk-list .wcard.today')), await T('#wk-list .wcard.today'));
ok('semana: resumen', /Objetivo/.test(await T('#wk-totals')) && /5,1/.test(await T('#wk-totals')), await T('#wk-totals'));
// 13. progreso y gráficas
await p.click('.nav-side a[data-tab="progreso"]'); await wait(300);
for (const c of ['#ch-kcal','#ch-peso','#ch-prot','#ch-ent','#ch-dist','#ch-fc']) ok('gráfica '+c, await p.locator(c+' svg').count()===1);
ok('Elite Score con número y sin recuperación inventada', /^\d+$/.test((await T('#pg-elite .ring-c b')).trim()) && /No se calcula/.test(await T('#pg-elite')), await T('#pg-elite .ring-c')+' | '+await T('#pg-elite .cbars'));
ok('progreso: fila de métricas', /Peso actual/.test(await T('#pg-tiles')) && /Desde inicio/.test(await T('#pg-tiles')), await T('#pg-tiles'));
await p.screenshot({path:SHOT('f2-desk-progreso.png'),fullPage:true});
// 14. editar datos del perfil
await p.click('.nav-side a[data-tab="datos"]'); await wait(200); await p.selectOption('#p-goal','mant'); await p.selectOption('#h-cond','dm2'); await p.click('#p-form button[type=submit]'); await wait(300);
await p.click('.nav-side a[data-tab="hoy"]'); await wait(300);
const f=await T('#d-label .formula');
ok('editar datos: objetivo pasa a mantener (sin déficit)', !/−/.test(f), f);
ok('modo salud: tarjeta de glucosa visible', await p.isVisible('#glu-card'));
await p.click('#glu-card [data-sheet="glu"]'); await wait(200); await p.fill('#g-val','104'); await p.click('#g-form button[type=submit]'); await wait(300);
ok('glucosa registrada', /104/.test(await T('#d-glu')), await T('#d-glu'));
// 15. persistencia
const before=await T('#d-label .kv'); await p.reload(); await wait(500);
ok('persistencia al recargar', (await T('#d-label .kv'))===before && /de GPX/.test(await T('#d-sess .acts')) && /72,4/.test(await T('#d-peso')), await T('#d-label .kv'));
await p.screenshot({path:SHOT('f2-desk-hoy.png'),fullPage:true});
// 16. claro/oscuro
const bg=()=>p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
const b0=await bg(); await p.click('#ui-btn'); await wait(150); const b1=await bg(); ok('modo claro/oscuro', b0==='#080a0d' && b1==='#f3f4f6', b0+' → '+b1);
await p.screenshot({path:SHOT('f2-desk-hoy-claro.png'),fullPage:false}); await p.click('#ui-btn'); await wait(100);
ok('escritorio: sin desborde lateral', await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)===0);
// 17. móvil
await p.setViewportSize({width:400,height:860}); await wait(300);
ok('móvil: barra inferior visible, menú lateral oculto', await p.isVisible('.nav-bottom') && !(await p.isVisible('.nav-side')));
ok('móvil: sin desborde lateral en Hoy', await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)===0);
await p.screenshot({path:SHOT('f2-movil-hoy.png'),fullPage:true});
for (const tab of ['semana','progreso','datos','hoy']){ await p.click(`.nav-bottom a[data-tab="${tab}"]`); await wait(200); const ov=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth); ok('móvil: '+tab+' abre y no desborda', ov===0 && await p.isVisible(tab==='datos'?'#v-datos':'#v-'+tab), 'desborde '+ov); if(tab==='semana') await p.screenshot({path:SHOT('f2-movil-semana.png'),fullPage:true}); }
await p.click('.fab'); await wait(250);
ok('móvil: + abre el menú rápido con 5 acciones (con glucosa)', await p.evaluate(()=>document.querySelector('#sh-quick').open) && await p.locator('#sh-quick .choice:visible').count()===5);
await p.screenshot({path:SHOT('f2-movil-quick.png')});
await p.click('[data-quick="meal"]'); await wait(250);
ok('móvil: menú rápido → hoja de comida', await p.evaluate(()=>document.querySelector('#sh-meal').open && !document.querySelector('#sh-quick').open));
await p.click('#f-manual'); await wait(100); await p.screenshot({path:SHOT('f2-movil-comida.png')});
await p.keyboard.press('Escape'); await wait(150); ok('Escape cierra la hoja', !(await p.evaluate(()=>document.querySelector('#sh-meal').open)));
await p.click('.nav-bottom a[data-tab="datos"]'); await wait(200); ok('móvil: enlace a Competiciones en Perfil', await p.isVisible('.linkcard'));
await p.click('.linkcard'); await wait(200); ok('móvil: Competiciones abre', await p.isVisible('#v-comp')); await p.screenshot({path:SHOT('f2-movil-comp.png'),fullPage:true});
console.log(res.join('\n')); console.log('\n'+(res.length-fails)+' de '+res.length+' pruebas bien'); console.log(errs.length?[...new Set(errs)].join('\n'):'sin errores de script');
await b.close();
