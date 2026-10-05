// Genera los iconos de la app instalable a partir del símbolo. Uso: node src/hacer_iconos.mjs
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'; import fs from 'node:fs';
const svg = fs.readFileSync(new URL('../elitepro-simbolo.svg', import.meta.url), 'utf8').replace(/ width="512" height="512"/, '');
const inner = svg.replace(/<rect width="150" height="150" rx="30" fill="#10161d"\/>/, ''); // el símbolo sin su fondo redondeado
const b = await chromium.launch(), p = await (await b.newContext({ deviceScaleFactor: 1 })).newPage();
const shot = async (file, size, html, clear) => { await p.setViewportSize({ width: size, height: size }); await p.setContent(`<body style="margin:0;background:${clear ? 'transparent' : '#10161d'}">${html}</body>`); await p.screenshot({ path: new URL('../icons/' + file, import.meta.url).pathname, omitBackground: clear }); };
const sized = (s, px) => s.replace('<svg ', `<svg width="${px}" height="${px}" style="display:block" `);
const padded = (size, part) => { const px = Math.round(size * part), m = Math.round((size - px) / 2); return `<div style="padding:${m}px">${sized(inner, px)}</div>`; };
await shot('icon-192.png', 192, sized(svg, 192), true);
await shot('icon-512.png', 512, sized(svg, 512), true);
await shot('maskable-512.png', 512, padded(512, 0.72), false); // el sistema recorta: el dibujo va dentro de la zona segura
await shot('apple-180.png', 180, padded(180, 0.86), false);     // iOS pone sus propias esquinas: fondo completo
await b.close(); console.log('iconos listos');
