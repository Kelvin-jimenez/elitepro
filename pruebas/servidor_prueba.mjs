// Servidor de prueba: ejecuta nube/Code.gs con una imitación de los servicios de Google
// (hoja de cálculo, propiedades, caché) para probar la app sin tocar ningún Drive real.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import crypto from 'node:crypto';
const root = path.resolve(process.argv[2] || '.'), port = Number(process.argv[3] || 8787);
const signed = buf => [...buf].map(b => b > 127 ? b - 256 : b);
class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.maxCols = 26; }
  getMaxRows() { return 1000; } getMaxColumns() { return this.maxCols; }
  getLastRow() { for (let i = this.rows.length; i > 0; i--) if ((this.rows[i - 1] || []).some(v => v !== '' && v != null)) return i; return 0; }
  insertColumnsAfter(c, n) { this.maxCols += n; } setFrozenRows() {}
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this, rg = {
      setNumberFormat() { return rg; }, setFontWeight() { return rg; },
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sh.rows[r - 1 + i] || [])[c - 1 + j] ?? '')); },
      getValue() { return rg.getValues()[0][0]; },
      setValues(v) {
        if (c + nc - 1 > sh.maxCols) throw new Error('fuera de la hoja');
        v.forEach((row, i) => row.forEach((val, j) => {
          if (typeof val !== 'string') throw new Error('solo texto en la hoja');
          if (val.length > 50000) throw new Error('celda de más de 50.000 caracteres');
          if (/^[=+\-@]/.test(val)) throw new Error('la celda se leería como fórmula: ' + val.slice(0, 12));
          (sh.rows[r - 1 + i] = sh.rows[r - 1 + i] || [])[c - 1 + j] = val;
        })); return rg;
      }
    }; return rg;
  }
}
const sheets = {}, props = {}, cache = {}, stats = { slept: 0, busy: false }, delay = { op: '', ms: 0 };
const ctx = {
  SpreadsheetApp: { flush() {}, getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) }), getUi() { throw new Error('sin interfaz'); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: k => (cache[k] && cache[k].t > Date.now() ? cache[k].v : null), put: (k, v, s) => { cache[k] = { v, t: Date.now() + s * 1000 }; }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => !stats.busy, releaseLock() {} }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (a, s) => signed(crypto.createHash('sha256').update(s, 'utf8').digest()),
    computeHmacSha256Signature: (v, k) => signed(crypto.createHmac('sha256', k).update(v, 'utf8').digest()),
    getUuid: () => crypto.randomUUID(), sleep: ms => { stats.slept += ms; },
    formatDate: d => new Date(d.getTime() + 2 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  Logger: { log() {} }, console
};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'nube', 'Code.gs'), 'utf8') + '\nthis.doPost = doPost; this.prepararElitepro = prepararElitepro;', ctx);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api' && req.method === 'POST') { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { const out = ctx.doPost({ postData: { contents: b } }); let op = ''; try { op = JSON.parse(b).op; } catch (e) { /* cuerpo raro */ } setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(out.s); }, delay.op === op ? delay.ms : 0); }); return; }
  if (u.pathname === '/__delay') { delay.op = u.searchParams.get('op') || ''; delay.ms = Number(u.searchParams.get('ms') || 0); res.end('ok'); return; }
  if (u.pathname === '/__setup') { res.end(ctx.prepararElitepro()); return; }
  if (u.pathname === '/__dump') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ sheets: Object.fromEntries(Object.entries(sheets).map(([k, v]) => [k, v.rows])), props, stats })); return; }
  if (u.pathname === '/__busy') { stats.busy = u.searchParams.get('on') === '1'; res.end('ok'); return; }
  if (u.pathname === '/__clearcache') { Object.keys(cache).forEach(k => delete cache[k]); res.end('ok'); return; }
  const f = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(port, () => console.log('servidor de prueba en http://localhost:' + port));
