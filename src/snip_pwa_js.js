/* ---------- App instalable: icono en la pantalla de inicio, pantalla completa y uso sin conexión ---------- */
let pwaEvt = null;
const pwaIn = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const pwaIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const pwaOtherIos = () => pwaIos() && /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|FB_IAB|Line\/|WhatsApp|GSA\//i.test(navigator.userAgent); // en iPhone solo Safari instala bien
const pwaAccount = () => { try { return Object.keys(localStorage).some(k => k.indexOf("elitepro:cloud:") === 0 && !!(JSON.parse(localStorage.getItem(k)) || {}).token); } catch (e) { return false; } };
const PWA_SHARE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`;
const PWA_ADD = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`;
document.body.insertAdjacentHTML("beforeend", `<dialog class="sheet" id="sh-pwa" aria-labelledby="sh-pwa-t"><div class="sheet-in">
  <div class="sheet-head"><h2 id="sh-pwa-t">Instalar en el móvil</h2><button class="icon-btn" type="button" data-close aria-label="Cerrar">×</button></div>
  <div id="pwa-steps" class="col" style="gap:12px"></div>
</div></dialog>
<style>.psteps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;counter-reset:ps}.psteps li{counter-increment:ps;display:flex;gap:12px;align-items:center;background:var(--surface-2);border:1px solid var(--line);border-radius:14px;padding:12px 14px;color:var(--ink);line-height:1.4}.psteps li::before{content:counter(ps);flex:0 0 30px;height:30px;border-radius:50%;background:var(--btn);color:var(--on-btn);display:grid;place-items:center;font-weight:800}.psteps li>span{flex:1 1 auto;min-width:0}.psteps li>svg{flex:0 0 auto;color:var(--mark)}.pwarn{border:1px solid var(--line);border-left:3px solid var(--mark);border-radius:10px;padding:10px 12px;font-size:.92rem;color:var(--ink-2);line-height:1.45}</style>`);
$("#v-hoy .dash").insertAdjacentHTML("beforebegin", `<div class="card" id="pwa-cta" hidden style="flex-direction:row;align-items:center;gap:10px 12px;flex-wrap:wrap;padding:14px 18px"><span style="flex:1 1 220px;min-width:0"><b>Lleva Elitepro en el móvil.</b> <span class="sub">Con su icono, a pantalla completa y sin conexión.</span></span><button class="btn sm" type="button" id="pwa-how">Instalar</button><button class="icon-btn" type="button" id="pwa-x" aria-label="No mostrar más este aviso">×</button></div>`);
/* Los pasos, según el móvil: en Android hay botón directo; en iPhone Apple solo deja hacerlo desde el menú Compartir de Safari */
function pwaSteps() {
  const acct = pwaAccount(), data = acct ? `<p class="pwarn"><b>Al abrirla por primera vez</b>, entra con tu cuenta (Perfil → «Ya tengo cuenta») y aparecen todos tus datos. Desde entonces usa siempre el icono.</p>`
    : `<p class="pwarn"><b>Antes de instalarla, crea tu cuenta en la nube</b> (Perfil → Cuenta en la nube). En iPhone la app instalada empieza vacía: al abrirla entras con tu cuenta y recuperas todo.</p>`;
  $("#pwa-steps").innerHTML = pwaEvt ? `<p class="sub">Se pone en tu pantalla de inicio como una app más: con su icono, a pantalla completa y funciona sin conexión.</p><div class="row"><button class="btn" type="button" id="pwa-go">Instalar Elitepro</button></div>`
    : pwaOtherIos() ? `<p class="sub">En iPhone solo se puede instalar desde <b>Safari</b>, y ahora la tienes abierta en otra app.</p><ol class="psteps"><li><span>Copia el enlace de Elitepro.</span></li><li><span>Abre <b>Safari</b> y pégalo en la barra de direcciones.</span></li><li><span>Allí vuelve a pulsar <b>Instalar</b> y sigue los pasos.</span></li></ol><div class="row"><button class="btn" type="button" id="pwa-copy">Copiar enlace</button></div>`
    : pwaIos() ? `<p class="sub">Son tres toques, sin pasar por la App Store:</p><ol class="psteps"><li><span>Pulsa <b>Compartir</b> en la barra de Safari (abajo, en el centro).</span>${PWA_SHARE}</li><li><span>Baja por el menú y elige <b>«Añadir a pantalla de inicio»</b>.</span>${PWA_ADD}</li><li><span>Pulsa <b>Añadir</b>, arriba a la derecha. Ya tienes el icono de Elitepro.</span></li></ol>${data}`
    : `<p class="sub">Se pone en tu pantalla de inicio como una app más.</p><ol class="psteps"><li><span>Abre el menú del navegador <b>(⋮)</b>, arriba a la derecha.</span></li><li><span>Elige <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</span>${PWA_ADD}</li><li><span>Confirma con <b>Instalar</b>.</span></li></ol>`;
}
function pwaPaint() {
  const web = location.protocol.indexOf("http") === 0, mobile = pwaIos() || /android/i.test(navigator.userAgent) || !!pwaEvt; let off = false;
  try { off = localStorage.getItem("elitepro:pwa:x") === "1"; } catch (e) { off = false; }
  $("#pwa-cta").hidden = pwaIn() || !web || !mobile || off;
  const card = $("#pwa-card"); if (!card) return;
  card.hidden = pwaIn() || !web;
  $("#pwa-body").innerHTML = `<p class="sub">Ponla en la pantalla de inicio: se abre a pantalla completa, con su icono, y funciona sin conexión.</p><div class="row"><button class="btn" type="button" id="pwa-how2">${pwaEvt ? "Instalar Elitepro" : "Ver cómo se instala"}</button></div>`;
}
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("#pwa-how, #pwa-how2, #pwa-x, #pwa-copy"); if (!t) return;
  if (t.id === "pwa-x") { try { localStorage.setItem("elitepro:pwa:x", "1"); } catch (x) { /* sin almacenamiento */ } $("#pwa-cta").hidden = true; return; }
  if (t.id === "pwa-copy") { const url = location.origin + location.pathname; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("Enlace copiado. Pégalo en Safari."), () => toast(url)); return; }
  pwaSteps(); openSheet("pwa");
});
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); pwaEvt = e; pwaPaint(); });
window.addEventListener("appinstalled", () => { pwaEvt = null; pwaPaint(); closeSheets(); toast("Elitepro instalada."); });
document.addEventListener("click", async e => { if (!e.target.closest("#pwa-go") || !pwaEvt) return; const ev = pwaEvt; pwaEvt = null; ev.prompt(); try { await ev.userChoice; } catch (x) { /* cerrado */ } pwaPaint(); pwaSteps(); });
pwaPaint();
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(() => { /* sin soporte: la app sigue funcionando con conexión */ });
