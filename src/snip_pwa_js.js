/* ---------- App instalable: icono en la pantalla de inicio, pantalla completa y uso sin conexión ---------- */
let pwaEvt = null;
const pwaIn = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
function pwaPaint() {
  const card = $("#pwa-card"); if (!card) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  card.hidden = pwaIn() || location.protocol.indexOf("http") !== 0;
  $("#pwa-body").innerHTML = pwaEvt ? `<p class="sub">Ponla en la pantalla de inicio: se abre a pantalla completa, con su icono, y funciona sin conexión.</p><div class="row"><button class="btn" type="button" id="pwa-go">Instalar Elitepro</button></div>`
    : ios ? `<p class="sub">En iPhone o iPad, con Safari: pulsa el botón <b>Compartir</b> y elige <b>«Añadir a pantalla de inicio»</b>. Se abre a pantalla completa, con su icono, y funciona sin conexión.</p><p class="sub"><b>Antes, crea tu cuenta en la nube.</b> En iPhone la app instalada empieza vacía; al abrirla, entra con tu cuenta y recuperas todos tus datos.</p>`
    : `<p class="sub">En el menú del navegador (⋮) elige <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>. Se abre a pantalla completa, con su icono, y funciona sin conexión.</p>`;
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); pwaEvt = e; pwaPaint(); });
window.addEventListener("appinstalled", () => { pwaEvt = null; pwaPaint(); toast("Elitepro instalada."); });
document.addEventListener("click", async e => { if (!e.target.closest("#pwa-go") || !pwaEvt) return; const ev = pwaEvt; pwaEvt = null; ev.prompt(); try { await ev.userChoice; } catch (x) { /* cerrado */ } pwaPaint(); });
pwaPaint();
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(() => { /* sin soporte: la app sigue funcionando con conexión */ });
