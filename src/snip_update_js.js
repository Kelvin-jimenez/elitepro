/* ---------- Versión: cuando hay una publicación nueva, la app se actualiza sola (o avisa si estás a medias de algo) ---------- */
const BUILD = "__BUILD__";
async function upGo(v) {
  try { sessionStorage.setItem("elitepro:upd", v); } catch (e) { /* sin almacenamiento */ }
  try { await fetch(location.pathname, { cache: "reload" }); } catch (e) { /* sin conexión */ } // renueva la copia guardada por el navegador
  location.reload();
}
async function upCheck() {
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return;
    const v = String((await r.json()).v || ""); if (!v || v === BUILD) return;
    let tried = ""; try { tried = sessionStorage.getItem("elitepro:upd") || ""; } catch (e) { tried = ""; }
    if (tried !== v && !document.querySelector("dialog[open]") && !profDirty) return upGo(v); // nada a medias: se actualiza sin preguntar
    if ($("#upd-bar")) return;
    $("#banner").insertAdjacentHTML("beforebegin", `<p class="banner" id="upd-bar"><span>Hay una versión nueva de Elitepro.</span><button type="button" id="upd-go" style="background:var(--btn);color:var(--on-btn);border-radius:10px;padding:7px 12px;font-weight:700;font-size:.9rem">Actualizar</button></p>`);
    $("#upd-go").addEventListener("click", () => upGo(v));
  } catch (e) { /* sin conexión o copia local: no hay nada que comprobar */ }
}
if (location.protocol.indexOf("http") === 0) {
  setTimeout(upCheck, 1500);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) upCheck(); });
}
