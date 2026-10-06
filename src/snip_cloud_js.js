/* ---------- Cuenta en la nube (solo versión web): copia cifrada en el servidor de Elitepro ---------- */
const CLOUD_URL = "__CLOUD_URL__", CLOUD_KID = "__CLOUD_KID__";
const CERR = { credenciales: "Correo o contraseña incorrectos.", invitacion: "Ese código de invitación no vale o ya se ha usado.", existe: "Ya hay una cuenta con ese correo. Usa «Ya tengo cuenta».", espera: "Demasiados intentos. Espera unos minutos y vuelve a probar.", sesion: "La sesión ha caducado. Vuelve a entrar.", sin_configurar: "La nube todavía no está en marcha.", consentimiento: "Hace falta que aceptes la política de privacidad.", datos: "Revisa los datos: hay algo que no vale.", llave: "La llave del responsable no coincide con la de esta versión de la app. No se ha enviado nada: avisa al responsable." };
Object.assign(CERR, { red: "No hay conexión con la nube. Comprueba tu internet e inténtalo otra vez.", lento: "La nube está tardando demasiado en contestar. Espera un minuto e inténtalo otra vez.", ocupado: "La nube está ocupada ahora mismo. Espera un minuto e inténtalo otra vez.", raro: "La nube ha contestado algo inesperado. Inténtalo otra vez en un minuto.", codigo: "Ese código no vale o ha caducado. Pide otro.", correo: "No se ha podido enviar el correo con el código. Inténtalo otra vez en un rato.", op: "Esto todavía no está activado en la nube. Vuelve a probar en un rato." });
/* Cada fallo dice lo que es: de conexión, del servidor o de este dispositivo */
const cMsg = e => CERR[e && e.code] || (e && e.code ? "La nube ha dado un error (" + e.code + "). Inténtalo otra vez en un minuto; si sigue, avisa al responsable." : "Ha fallado algo en este dispositivo" + (e && e.message ? ": " + String(e.message).slice(0, 120) : "") + ".");
const CNOTE = "Lo que apuntes se guarda solo en este navegador. Crea una cuenta en Perfil para tener una copia en la nube.";
let cs = null, csFor = null, cT = 0, cBusy = false, cAgain = false, cState = "", cMode = "", cRst = "";
const cOn = () => !!(cs && !cs.out);
function cLoad() {
  csFor = users.current; try { cs = JSON.parse(localStorage.getItem("elitepro:cloud:" + csFor) || "null"); } catch (e) { cs = null; }
  if (cs && !(cs.base && cs.base.c && cs.base.h && cs.base.c.d && cs.base.h.d)) { cs.base = cEmpty(); cs.fresh = true; }
  cState = cOn() && !cs.token ? "login" : "";
}
/* La llave pública del responsable se comprueba antes de usarla: su huella debe ser la que anuncia el servidor y, si la app lleva una fijada, esa */
async function cPub() {
  const p = await EPC.api(CLOUD_URL, { op: "pub" }), kid = (await EPC.sha(p.pub)).slice(0, 16);
  if (kid !== p.kid || (CLOUD_KID && kid !== CLOUD_KID)) throw Object.assign(new Error("llave"), { code: "llave" });
  return p;
}
function cStore(me) { try { if (me === undefined) me = cs; if (me) localStorage.setItem("elitepro:cloud:" + me.uid, JSON.stringify(me)); else localStorage.removeItem("elitepro:cloud:" + csFor); } catch (e) { /* sin almacenamiento */ } }
/* Huella de cada día y del perfil: sirve para saber qué ha cambiado aquí desde la última sincronización */
const canon = o => o === null || typeof o !== "object" ? String(JSON.stringify(o)) : Array.isArray(o) ? "[" + o.map(canon).join(",") + "]" : "{" + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ":" + canon(o[k])).join(",") + "}";
const h53 = str => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); a = Math.imul(a ^ ch, 2654435761); b = Math.imul(b ^ ch, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36); };
/* Cada dato tiene dos partes: la de entreno y nutrición, y la de salud (condición, límites del médico, lesiones, glucosa y cómo dice que se encuentra cada día).
   La de salud solo sale del dispositivo con consentimiento expreso. */
const cCore = (kind, o) => { if (!o) return null; const c = Object.assign({}, o); if (kind === "p") { delete c.health; delete c.injuries; delete c.medrem; } else { delete c.glu; delete c.feel; } return c; };
/* Los recordatorios de medicación (`medrem`) no se suben nunca, ni siquiera con el consentimiento de salud */
const cLocal = (kind, o) => { if (kind !== "p" || !o || o.medrem === undefined) return o; const c = Object.assign({}, o); delete c.medrem; return c; };
const cHealth = (kind, o) => { if (!o) return null; if (kind === "p") return (o.health && o.health.cond) || (o.injuries || []).length ? { health: o.health, injuries: o.injuries } : null; const h = {}; if ((o.glu || []).length) h.glu = o.glu; if (o.feel) h.feel = o.feel; return Object.keys(h).length ? h : null; };
const hC = (kind, o) => o ? h53(canon(cCore(kind, o))) : "";
const hH = (kind, o) => { const x = cHealth(kind, o); return x ? h53(canon(x)) : ""; };
const cOut = (me, kind, o) => (!o ? o : me.health ? cLocal(kind, o) : cCore(kind, o));
function cSnap(me) { const days = {}; Object.keys(S.days).forEach(k => { days[k] = cOut(me, "d", S.days[k]); }); return { profile: cOut(me, "p", S.profile), days }; }
const cEmpty = () => ({ c: { p: "", d: {} }, h: { p: "", d: {} } });
function cHashes(me, data) { const b = cEmpty(); b.c.p = hC("p", data.profile); if (me.health) b.h.p = hH("p", data.profile); Object.keys(data.days || {}).forEach(k => { b.c.d[k] = hC("d", data.days[k]); const x = me.health ? hH("d", data.days[k]) : ""; if (x) b.h.d[k] = x; }); return b; }
const cSameMap = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
const cSame = (a, b) => a.c.p === b.c.p && a.h.p === b.h.p && cSameMap(a.c.d, b.c.d) && cSameMap(a.h.d, b.h.d);
/* Junta lo de la nube con lo de aquí: gana lo que se haya cambiado en este dispositivo desde la última sincronización; el resto se toma de la nube.
   `adopt`: este dispositivo acaba de enterarse de que se consintió subir la salud en otro; toma la salud de la nube donde la haya.
   `fresh`: primera vez que este dispositivo se junta con la cuenta; no sabe qué es más nuevo, así que en lo que coincida manda la nube
   y lo que solo exista aquí se conserva y se sube. */
function cMerge(me, R, adopt, fresh) {
  const B = me.base || cEmpty(), out = { profile: null, days: {} }, rd = R.days || {}; let changed = false;
  const keep = (kind, loc, rem, bc, bh) => {
    let core;
    if (fresh) { core = cCore(kind, rem || loc); if (rem && hC(kind, rem) !== hC(kind, loc)) changed = true; }
    else if (hC(kind, loc) !== bc) core = cCore(kind, loc); else { core = cCore(kind, rem); if (hC(kind, rem) !== bc) changed = true; }
    if (!core) return null;
    const lh = cHealth(kind, loc), rh = cHealth(kind, rem); let hp;
    if (!me.health) hp = lh;
    else if (adopt || fresh) { hp = rh || lh; if (rh && hH(kind, rem) !== hH(kind, loc)) changed = true; }
    else if (hH(kind, loc) !== bh) hp = lh;
    else { hp = rh; if (hH(kind, rem) !== bh) changed = true; }
    return Object.assign({}, core, hp || {}, kind === "p" && loc && loc.medrem !== undefined ? { medrem: loc.medrem } : {});
  };
  out.profile = keep("p", S.profile, R.profile, B.c.p, B.h.p);
  new Set(Object.keys(S.days).concat(Object.keys(rd))).forEach(k => { const v = keep("d", S.days[k], rd[k], B.c.d[k] || "", B.h.d[k] || ""); if (v) out.days[k] = v; });
  return { out, changed };
}
const cRaw = saveLocal;
function cApply(out) {
  S.profile = out.profile ? normProfile(out.profile) : null; S.days = {};
  Object.keys(out.days).forEach(k => { S.days[k] = normDay(out.days[k], k); });
  if (!profDirty) profFilled = false;
  cRaw(); render();
}
async function cSync(pull, remote) {
  const me = cs; if (!me || !me.token) return;
  if (cBusy) { cAgain = true; return; }
  cBusy = true; cSet("sync");
  const mine = () => cs === me && csFor === users.current, put = () => { if (cs === me) cStore(me); };
  /* El consentimiento de salud es de la cuenta: si se cambió en otro dispositivo, este lo respeta */
  const flag = r => { if (me.hd || typeof r.health !== "boolean" || r.health === !!me.health) return false; me.health = r.health; if (!r.health) me.base.h = cEmpty().h; return r.health; };
  try {
    const dek = EPC.unb64(me.dek); let adopt = false, done = false;
    if (!remote && pull) { const r = await EPC.api(CLOUD_URL, { op: "load", token: me.token }); if (r.ckid && r.ckid !== me.kid) me.rewrap = true; if (typeof r.ai === "boolean" && r.ai !== !!me.ai) { me.ai = r.ai; put(); } if (r.rev !== me.rev) remote = r; }
    for (let i = 0; i < 6 && !done; i++) {
      if (remote) {
        adopt = flag(remote) || adopt || !!me.adopt;
        const data = (await EPC.open(dek, remote.blob)) || { profile: null, days: {} };
        if (!mine()) return;
        const m = cMerge(me, data, adopt, !!me.fresh); adopt = false; me.adopt = false; me.fresh = false;
        me.base = cHashes(me, data); me.rev = remote.rev; remote = null;
        if (m.changed) cApply(m.out);
        put();
      }
      if (!mine()) return;
      const snap = cSnap(me), hs = cHashes(me, snap);
      if (!(me.rewrap || me.hd || !cSame(hs, me.base))) { done = true; break; }
      const body = { op: "save", token: me.token, rev: me.rev, blob: await EPC.seal(dek, snap), health: !!me.health, hset: !!me.hd };
      if (me.rewrap) { const p = await cPub(); body.wrapCoach = await EPC.wrapFor(p.pub, dek); body.kid = p.kid; }
      const r = await EPC.api(CLOUD_URL, body);
      if (r.conflict) { remote = r; continue; }
      me.rev = r.rev; me.base = hs; if (body.kid) { me.kid = body.kid; me.rewrap = false; }
      if (body.hset && !!me.health === body.health) me.hd = false; // si la casilla cambió mientras se guardaba, el cambio sigue pendiente
      put();
    }
    if (!done) throw Object.assign(new Error("red"), { code: "red" });
    me.at = Date.now(); put(); if (mine()) cSet("ok");
  } catch (e) {
    if (e && e.code === "sesion") { me.token = ""; put(); if (mine()) { cSet("login"); cNote(); } }
    else if (mine()) { cSet(e && e.code === "llave" ? "llave" : "err"); if (!(e && e.code === "llave")) { clearTimeout(cT); cT = setTimeout(() => cSync(true), 45000); } } // se reintenta sola al rato
  } finally { cBusy = false; if (cAgain) { cAgain = false; cTouch(); } }
}
function cTouch() { clearTimeout(cT); if (cs && cs.token) cT = setTimeout(() => cSync(false), 2500); }
saveLocal = function () { cRaw(); cTouch(); };
function cNote() { if (S.mode === "local" && !$("#banner").classList.contains("err")) banner(cs && cs.token ? "" : CNOTE); }

/* ---------- Tarjeta de Perfil y hoja de cuenta ---------- */
document.body.insertAdjacentHTML("beforeend", `<dialog class="sheet" id="sh-cloud" aria-labelledby="sh-cloud-t"><div class="sheet-in">
  <div class="sheet-head"><h2 id="sh-cloud-t"></h2><button class="icon-btn" type="button" data-close aria-label="Cerrar">×</button></div>
  <form id="cl-form" class="col" style="gap:12px"></form>
</div></dialog>
<style>.chk{display:flex;gap:10px;align-items:flex-start;font-size:.9rem;color:var(--ink-2);line-height:1.4;cursor:pointer}.chk input{width:20px;height:20px;flex:0 0 auto;margin-top:1px;accent-color:var(--mark)}#cl-body a,#cl-form a{color:var(--ink);text-decoration:underline}#cl-form input:not([type="checkbox"]){background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:44px;width:100%;min-width:0;color:var(--ink);font:inherit}.pw{position:relative;display:block}.pw input{padding-right:52px}.eye{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:44px;height:40px;display:grid;place-items:center;background:none;border:0;border-radius:8px;color:var(--muted);cursor:pointer}.eye:hover,.eye[data-eye="on"]{color:var(--ink)}.eye:focus-visible{outline:2px solid var(--mark);outline-offset:-2px}.eye .off{display:none}.eye[data-eye="on"] .off{display:inline}.lnk{background:none;border:0;padding:6px 0;color:var(--ink);text-decoration:underline;font:inherit;font-size:.9rem;cursor:pointer;text-align:left}.warn{border:1px solid var(--line);border-left:3px solid var(--crit);border-radius:10px;padding:10px 12px;font-size:.9rem;color:var(--ink-2);line-height:1.45}</style>`);
$("#v-need").insertAdjacentHTML("beforeend", `<div><button class="btn ghost" type="button" data-cl="login">Ya tengo cuenta en la nube</button></div>`);
/* Aviso en Hoy para quien aún no tiene cuenta: una línea que se puede cerrar */
$("#v-hoy .dash").insertAdjacentHTML("beforebegin", `<div class="card" id="cl-cta" hidden style="flex-direction:row;align-items:center;gap:10px 12px;flex-wrap:wrap;padding:14px 18px"><span style="flex:1 1 240px;min-width:0"><b>Guarda tus datos en la nube.</b> <span class="sub">No se pierden si cambias de móvil. Hace falta un código de invitación.</span></span><button class="btn sm" type="button" data-cl="register">Crear cuenta</button><button class="btn ghost sm" type="button" data-cl="login">Ya tengo cuenta</button><button class="icon-btn" type="button" id="cl-cta-x" aria-label="No mostrar más este aviso">×</button></div>`);
function cCta() { let off = false; try { off = localStorage.getItem("elitepro:cta:" + users.current) === "1"; } catch (e) { off = false; } $("#cl-cta").hidden = cOn() || off || !S.profile || S.mode !== "local"; }
$("#cl-cta-x").addEventListener("click", () => { try { localStorage.setItem("elitepro:cta:" + users.current, "1"); } catch (e) { /* sin almacenamiento */ } $("#cl-cta").hidden = true; });
function cSet(st) {
  cCta(); cAi();
  cState = st; const chip = $("#cl-chip"), body = $("#cl-body"); if (!body) return;
  const on = !!(cs && cs.token), bad = st === "err" || st === "llave";
  chip.hidden = !cOn(); chip.textContent = !cOn() ? "" : st === "sync" ? "Sincronizando" : st === "llave" ? "En pausa" : st === "err" ? "Sin conexión" : !on ? "Sesión caducada" : "Conectada"; chip.className = "chip" + (on && !bad ? " done" : "");
  if (!cOn()) {
    body.innerHTML = `<p class="sub">Guarda una copia cifrada de tus datos en la nube de Elitepro: no se pierden si cambias de móvil y los tienes en todos tus dispositivos. Hace falta un código de invitación.</p>
      <div class="row"><button class="btn" type="button" data-cl="register">Crear cuenta</button><button class="btn ghost" type="button" data-cl="login">Ya tengo cuenta</button></div>
      <p class="sub"><a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p>`;
    return;
  }
  const when = cs.at ? new Date(cs.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  body.innerHTML = `<p><b>${esc(cs.email)}</b></p>
    <p class="sub" id="cl-status">${!on ? "La sesión ha caducado. Vuelve a entrar para seguir guardando en la nube." : st === "sync" ? "Sincronizando…" : st === "llave" ? CERR.llave : st === "err" ? "No hay conexión con la nube. Tus datos siguen en este dispositivo y se subirán cuando vuelva." : when ? "Última sincronización: " + esc(when) + "." : "Conectada."}</p>
    ${on ? `<label class="chk"><input type="checkbox" id="cl-health" ${cs.health ? "checked" : ""}><span>Consiento expresamente que también se guarden en la nube mis datos de salud (condición, límites del médico, glucosa, lesiones y cómo dices que te encuentras cada día). Si lo desmarcas, se borran de la nube y se quedan solo en este dispositivo.</span></label>` : ""}
    <div class="row">${on ? `<button class="btn ghost sm" type="button" data-cl="sync">Sincronizar ahora</button><button class="btn ghost sm" type="button" data-cl="passwd">Cambiar contraseña</button>` : `<button class="btn" type="button" data-cl="login">Volver a entrar</button>`}<button class="btn ghost sm" type="button" data-cl="logout">Cerrar sesión</button>${on ? `<button class="btn ghost sm" type="button" data-cl="remove">Borrar mi cuenta</button>` : ""}</div>
    <p class="sub"><a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a> · Para descargar todos tus datos usa «Descargar copia», aquí debajo.</p>`;
}
/* Las contraseñas llevan un botón para ver lo que se está escribiendo */
const EYE = `<button type="button" class="eye" data-eye="" aria-label="Ver la contraseña"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="off" d="M4 4l16 16"/></svg></button>`;
const cFld = (id, label, type, ac, extra) => { const inp = `<input id="${id}" type="${type}" autocomplete="${ac}" ${extra || ""} required>`; return `<label class="fld">${label}${type === "password" ? `<span class="pw">${inp}${EYE}</span>` : inp}</label>`; };
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-eye]"); if (!b) return;
  e.preventDefault(); const i = b.parentNode.querySelector("input"), on = i.type === "password";
  i.type = on ? "text" : "password"; b.dataset.eye = on ? "on" : ""; b.setAttribute("aria-label", (on ? "Ocultar" : "Ver") + " la contraseña"); i.focus();
});
/* ¿Conserva este dispositivo la llave de los datos de esa cuenta? Si la tiene, cambiar la contraseña no toca lo guardado */
const cKey = email => (cs && !cs.out && cs.dek && cs.email === email ? cs : null);
function cForm(mode) {
  cMode = mode; const who = "el equipo de Elitepro"; // quién es el responsable, con nombre y contacto, está en la política de privacidad enlazada
  $("#sh-cloud-t").textContent = { register: "Crear cuenta", login: "Entrar", passwd: "Cambiar contraseña", remove: "Borrar mi cuenta", reset1: "He olvidado la contraseña", reset2: "Contraseña nueva" }[mode];
  const mail = cFld("cl-email", "Correo", "email", "username", `value="${esc(cs && cs.email || "")}" maxlength="120"`);
  $("#cl-form").innerHTML = (mode === "register" ? mail + cFld("cl-pass", "Contraseña (mínimo 10 caracteres)", "password", "new-password", 'minlength="10"') + cFld("cl-pass2", "Repite la contraseña", "password", "new-password", 'minlength="10"') + cFld("cl-inv", "Código de invitación", "text", "off", 'placeholder="EP-XXXX-XXXX" maxlength="20"') +
      `<p class="sub">Con la contraseña se cifran tus datos antes de salir de este dispositivo. Guárdala bien: si la olvidas no se puede recuperar.</p>
      <label class="chk"><input type="checkbox" id="cl-terms" required><span>Tengo 18 años o más, he leído la <a href="privacidad.html" target="_blank" rel="noopener">política de privacidad</a> y acepto que mis datos de entreno y nutrición se guarden cifrados en la nube de Elitepro y que ${who} pueda verlos para hacer mi seguimiento.</span></label>
      <label class="chk"><input type="checkbox" id="cl-hc"><span>Además, consiento expresamente que se guarden y que ${who} pueda ver mis datos de salud: condición, límites del médico, glucosa, lesiones y cómo dices que te encuentras cada día. Es opcional: si no lo marcas, esos datos no salen de este dispositivo.</span></label>`
    : mode === "login" ? mail + cFld("cl-pass", "Contraseña", "password", "current-password")
    : mode === "passwd" ? cFld("cl-pass", "Contraseña actual", "password", "current-password") + cFld("cl-new", "Contraseña nueva (mínimo 10 caracteres)", "password", "new-password", 'minlength="10"') + cFld("cl-pass2", "Repite la nueva", "password", "new-password", 'minlength="10"')
    : mode === "reset1" ? `<p class="sub">Te mandamos un código de 6 cifras al correo de tu cuenta. Con él pones una contraseña nueva.</p>` + cFld("cl-email", "Correo de tu cuenta", "email", "username", `value="${esc(cRst)}" maxlength="120"${cs && cs.token ? " readonly" : ""}`)
    : mode === "reset2" ? `<p class="sub">Si hay una cuenta con <b>${esc(cRst)}</b>, acabamos de mandarle un código de 6 cifras. Puede tardar un minuto; mira también en la carpeta de correo no deseado. Vale 15 minutos.</p>` + cFld("cl-code", "Código de 6 cifras", "text", "one-time-code", 'inputmode="numeric" maxlength="8" placeholder="000000"') + cFld("cl-new", "Contraseña nueva (mínimo 10 caracteres)", "password", "new-password", 'minlength="10"') + cFld("cl-pass2", "Repite la nueva", "password", "new-password", 'minlength="10"') +
      (cKey(cRst) ? `<p class="sub">Tus datos no se tocan: solo cambia la contraseña.</p>`
        : `<div class="warn"><b>Léelo antes de seguir.</b> Tus datos se guardan cifrados con tu contraseña y este dispositivo no tiene la sesión abierta, así que no puede abrir lo que hay en la nube. Al poner la contraseña nueva, ${S.profile ? "tu cuenta se queda con lo que hay ahora en este dispositivo" : "tu cuenta se queda vacía, porque en este dispositivo no hay datos"}. Si en otro móvil u ordenador sigues con la sesión abierta, hazlo mejor desde allí (Perfil → Cambiar contraseña → No recuerdo la actual) y no se pierde nada.</div>
        <label class="chk"><input type="checkbox" id="cl-sure" required><span>Entiendo que lo guardado en la nube se sustituye por lo que hay en este dispositivo${S.profile ? "" : ", que está vacío"}. Los datos de salud no se suben hasta que vuelva a marcar su casilla.</span></label>`)
    : `<p class="sub">Se borran del servidor tu cuenta y todos tus datos. Lo que tienes en este dispositivo no se toca. No se puede deshacer.</p>` + cFld("cl-pass", "Contraseña", "password", "current-password"))
    + `<div class="row actions"><button class="btn" type="submit" id="cl-go">${{ register: "Crear cuenta", login: "Entrar", passwd: "Cambiar contraseña", remove: "Borrar mi cuenta y mis datos de la nube", reset1: "Enviarme el código", reset2: "Cambiar contraseña" }[mode]}</button></div>${mode === "login" ? `<button class="lnk" type="button" data-cl="reset1">He olvidado la contraseña</button>` : mode === "passwd" ? `<button class="lnk" type="button" data-cl="reset1">No recuerdo la actual</button>` : mode === "reset2" ? `<button class="lnk" type="button" data-cl="reset1">No me ha llegado: pedir otro código</button>` : ""}<p id="cl-msg" class="msg" aria-live="polite"></p>`;
  openSheet("cloud");
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-cl]"); if (!t) return;
  const a = t.dataset.cl;
  if (a === "sync") return cSync(true);
  if (a === "logout") { // se quitan la sesión y la llave; queda la marca de lo ya sincronizado para juntar bien si vuelve a entrar con la misma cuenta
    clearTimeout(cT); cs = { uid: cs.uid, email: cs.email, out: true, rev: cs.rev, base: cs.base, health: cs.health, kid: cs.kid, aiok: cs.aiok }; cStore(); cSet(""); cNote();
    return toast("Sesión cerrada. Tus datos siguen en este dispositivo.");
  }
  if (a === "reset1") { const typed = cMode === "login" && $("#cl-email") ? $("#cl-email").value.trim().toLowerCase() : ""; cRst = cs && cs.token ? cs.email : typed || cRst || (cs && cs.email) || ""; }
  cForm(a);
});
document.addEventListener("change", e => {
  if (e.target.id !== "cl-health" || !cs || !cs.token) return;
  cs.health = e.target.checked; cs.hd = true; cStore(); cSync(false);
  toast(cs.health ? "Tus datos de salud se guardarán también en la nube." : "Tus datos de salud se borran de la nube y se quedan aquí.");
});
$("#cl-form").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#cl-msg"), go = $("#cl-go"), val = id => ($("#" + id) ? $("#" + id).value : ""), say = (t, err) => { msg.textContent = t; msg.className = "msg" + (err ? " err" : ""); };
  document.querySelectorAll("#cl-form [data-eye='on']").forEach(b => b.click()); // al enviar, las contraseñas vuelven a ir ocultas
  const email = (cMode === "passwd" || cMode === "remove" ? cs.email : cMode === "reset2" ? cRst : val("cl-email")).trim().toLowerCase(), fresh = cMode === "passwd" || cMode === "reset2" ? val("cl-new") : val("cl-pass"), pass = cMode === "reset2" ? fresh : val("cl-pass");
  if (cMode === "register" || cMode === "passwd" || cMode === "reset2") {
    if (fresh !== val("cl-pass2")) return say("Las dos contraseñas no coinciden.", true);
    if (fresh.length < 10) return say("La contraseña tiene que tener al menos 10 caracteres.", true);
  }
  const code = val("cl-code").replace(/\D/g, "");
  if (cMode === "reset2" && code.length !== 6) return say("El código tiene 6 cifras.", true);
  go.disabled = true; say("Un momento…");
  try {
    if (cMode === "reset1") { await EPC.api(CLOUD_URL, { op: "reset_ask", email }); cRst = email; return cForm("reset2"); }
    const k = await EPC.derive(pass, "elitepro:user:" + email);
    if (cMode === "reset2") {
      const keep = cKey(email);
      if (keep) { // este dispositivo tiene la llave: se vuelve a guardar protegida con la contraseña nueva y los datos siguen como estaban
        const r = await EPC.api(CLOUD_URL, { op: "reset_do", email, code, auth: k.auth, wrapUser: EPC.b64(await EPC.enc(k.kek, EPC.unb64(keep.dek))) });
        keep.token = r.token; keep.ai = !!r.ai; cStore(keep);
        if (cs === keep) { closeSheets(); cSet("ok"); cNote(); cSync(true); }
      } else { // sin la llave, lo de la nube no se puede abrir: la cuenta empieza de nuevo con lo que hay aquí (la salud, solo si se vuelve a consentir)
        const pub = await cPub(), dek = EPC.rand(32), me = { uid: users.current, email, token: "", dek: EPC.b64(dek), rev: 0, base: cEmpty(), health: false, kid: pub.kid }, snap = cSnap(me);
        const r = await EPC.api(CLOUD_URL, { op: "reset_do", email, code, auth: k.auth, wrapUser: EPC.b64(await EPC.enc(k.kek, dek)), wrapCoach: await EPC.wrapFor(pub.pub, dek), kid: pub.kid, blob: await EPC.seal(dek, snap) });
        me.token = r.token; me.rev = r.rev; me.base = cHashes(me, snap); me.at = Date.now(); me.ai = !!r.ai;
        cs = me; csFor = me.uid; cStore(); closeSheets(); cSet("ok"); cNote();
      }
      cRst = ""; toast("Contraseña cambiada. En tus otros dispositivos tendrás que volver a entrar.");
    } else if (cMode === "register") {
      const pub = await cPub(), dek = EPC.rand(32);
      const me = { uid: users.current, email, token: "", dek: EPC.b64(dek), rev: 0, base: cEmpty(), health: $("#cl-hc").checked, kid: pub.kid };
      const snap = cSnap(me);
      const r = await EPC.api(CLOUD_URL, { op: "register", email, auth: k.auth, invite: val("cl-inv").trim(), consent: { adult: true, terms: $("#cl-terms").checked, health: me.health }, wrapUser: EPC.b64(await EPC.enc(k.kek, dek)), wrapCoach: await EPC.wrapFor(pub.pub, dek), kid: pub.kid, blob: await EPC.seal(dek, snap) });
      me.token = r.token; me.at = Date.now(); me.ai = !!r.ai;
      if (r.existing) { me.rev = -1; me.base = cEmpty(); me.fresh = true; } else { me.rev = r.rev; me.base = cHashes(me, snap); } // `existing`: el registro ya había entrado en un intento anterior
      cs = me; csFor = me.uid; cStore();
      closeSheets(); cSet("ok"); cNote(); toast("Cuenta creada. Tus datos ya se guardan en la nube."); if (r.existing) cSync(true); else cTouch();
    } else if (cMode === "login") {
      const r = await EPC.api(CLOUD_URL, { op: "login", email, auth: k.auth }), dek = await EPC.dec(k.kek, EPC.unb64(r.wrapUser));
      const old = cs && cs.email === email ? cs : null;
      cs = { uid: users.current, email, token: r.token, dek: EPC.b64(dek), rev: old ? old.rev : -1, base: old ? old.base : cEmpty(), health: !!r.health, adopt: !old && !!r.health, fresh: !old || !!old.fresh, ai: !!r.ai, aiok: !!(old && old.aiok), kid: r.kid, rewrap: !!(r.ckid && r.ckid !== r.kid) }; csFor = cs.uid; cStore();
      closeSheets(); cNote(); await cSync(true, r);
      toast("Dentro. Tus datos están al día con la nube."); if (S.profile && S.tab === "hoy") render(); else if (S.profile) location.hash = "#hoy";
    } else if (cMode === "passwd") {
      const n = await EPC.derive(val("cl-new"), "elitepro:user:" + email);
      const r = await EPC.api(CLOUD_URL, { op: "passwd", token: cs.token, auth: k.auth, next: n.auth, wrapUser: EPC.b64(await EPC.enc(n.kek, EPC.unb64(cs.dek))) });
      cs.token = r.token; cStore(); closeSheets(); toast("Contraseña cambiada. En tus otros dispositivos tendrás que volver a entrar.");
    } else {
      await EPC.api(CLOUD_URL, { op: "remove", token: cs.token, auth: k.auth });
      clearTimeout(cT); cs = null; cStore(); closeSheets(); cSet(""); cNote(); toast("Cuenta borrada de la nube.");
    }
  } catch (err) {
    if (err && err.code === "sesion" && cs) { cs.token = ""; cStore(); cSet("login"); }
    say(err && err.name === "OperationError" ? "Correo o contraseña incorrectos." : cMsg(err), true);
  } finally { const g = $("#cl-go"); if (g) g.disabled = false; }
});
/* ---------- IA fuera de Claude: con la sesión abierta, la foto del plato, «Calcular con IA» y el asistente pasan por el servidor de Elitepro,
   que guarda la clave de la API. No se envían datos de salud. La primera vez se pide aceptar un aviso. ---------- */
AIMSG.photo = AIMSG.calc = "Para usar la IA entra en tu cuenta: Perfil → Cuenta en la nube.";
aiWeb = true;
document.querySelectorAll("#sh-meal .only").forEach(el => { el.textContent = "Con tu cuenta en la nube"; });
document.body.insertAdjacentHTML("beforeend", `<dialog id="ai-ok" class="sheet" aria-labelledby="ai-ok-t" style="z-index:50"><div class="sheet-in">
  <div class="sheet-head"><h2 id="ai-ok-t">Antes de usar la IA</h2></div>
  <p class="sub">La inteligencia artificial la da Anthropic (Claude). Para contestarte, lo que escribas, las fotos y documentos que mandes (por ejemplo, tu plan), tus datos básicos (edad, peso, altura y objetivo) y un resumen de tus comidas y entrenos de la semana se envían a su servicio, que puede estar fuera de la Unión Europea. Elitepro no guarda esas conversaciones.</p>
  <p class="sub"><b>No se envían</b> tu nombre, tu correo ni tus datos de salud (condición, glucosa, lesiones, medicación). Si un documento tuyo los trae, recórtalos antes de mandarlo: no escribas ni envíes nada que no quieras compartir. Lo que calcula son estimaciones, no consejo médico. Más en la <a href="privacidad.html" target="_blank" rel="noopener" style="color:var(--ink)">política de privacidad</a>.</p>
  <div class="row actions"><button class="btn" type="button" id="ai-ok-yes">Entendido, usar la IA</button><button class="btn ghost" type="button" id="ai-ok-no">Ahora no</button></div>
</div></dialog>`);
function aiAsk() {
  return new Promise(res => {
    const d = $("#ai-ok"); let ans = false;
    $("#ai-ok-yes").onclick = () => { ans = true; d.close(); }; $("#ai-ok-no").onclick = () => d.close();
    d.addEventListener("close", () => res(ans), { once: true }); // también si se cierra de otra forma: cuenta como «ahora no»
    d.showModal();
  });
}
const aiErr = code => Object.assign(new Error(code), { code });
/* Las fotos se reducen antes de enviarlas: 1280 px de lado mayor, en JPEG (las páginas de un documento, 1568 px, para que se lean las tablas) */
async function aiShrink(file, px) {
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { throw aiErr("image_rejected"); }
  const k = Math.min(1, (px || 1280) / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
  return { type: "image", media_type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.82).split(",")[1] };
}
async function aiCall(prompt, o) {
  const me = cs; if (!me || !me.token) throw aiErr("session_expired");
  if (!me.aiok) { if (!(await aiAsk())) throw aiErr("need_ok"); me.aiok = true; if (cs === me) cStore(me); }
  const content = []; for (const f of Array.from((o && o.images && (o.images instanceof Blob ? [o.images] : o.images)) || [])) content.push(await aiShrink(f, o.px));
  for (const f of (o && o.docs) || []) { // los PDF van tal cual: los lee el modelo, sin pasar por ningún OCR
    if (f.size > 4 * 1024 * 1024) throw aiErr("too_big");
    const u8 = new Uint8Array(await f.arrayBuffer()); let bin = ""; for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    content.push({ type: "document", media_type: "application/pdf", data: btoa(bin) });
  }
  content.push({ type: "text", text: String(prompt).slice(0, 19000) });
  try { return (await EPC.api(CLOUD_URL, { op: "ai", token: me.token, messages: [{ role: "user", content }], max: Math.min((o && o.max) || 1100, 4000) }, 120000)).text; }
  catch (e) {
    const c = e && e.code;
    if (c === "sesion") { me.token = ""; if (cs === me) { cStore(me); cSet("login"); cNote(); } throw aiErr("session_expired"); }
    if (c === "sin_ia") { me.ai = false; if (cs === me) cStore(me); throw aiErr("capability_disabled"); }
    throw aiErr(c === "limite_ia" ? "rate_limited" : c === "ia_ocupada" ? "busy" : c === "datos" && content.length > 1 ? (o && o.docs ? "too_big" : "image_rejected") : "red");
  }
}
const webSample = Object.assign(async (prompt, o) => { const text = await aiCall(prompt, o); if (o && o.onText) o.onText({ text }); return { text }; }, {
  web: true,
  limits: async () => ({ images: true }),
  json: async (prompt, o) => {
    const t = await aiCall(prompt, o), a = t.indexOf("{"), b = t.lastIndexOf("}");
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw aiErr("invalid_json"); }
  }
});
AIERR.rate_limited = "Has llegado al límite de usos de la IA por hoy. Mañana vuelve a estar disponible.";
const closeAi = () => { const d = $("#sh-ai"); if (d && d.open) d.close(); };
/* La IA se enciende y se apaga con la sesión (y solo si el servidor tiene la clave puesta) */
function cAi() {
  const on = !!(cs && cs.token && cs.ai);
  if (on && !sample) { sample = webSample; canImg = true; showAi(); if (S.tab === "hoy" && S.profile) render(); }
  else if (!on && sample && sample.web) { sample = null; canImg = false; showAi(); closeAi(); if (S.tab === "hoy" && S.profile) render(); }
}
/* «Empezar de cero» borra lo de este dispositivo, no la cuenta: antes de borrar se desconecta, para que el vaciado no se suba a la nube */
document.addEventListener("click", e => {
  if (!e.target || e.target.id !== "rs-yes" || !cs) return;
  const had = !!cs.token; clearTimeout(cT); cs = null; cStore(); cSet("");
  setTimeout(() => { cNote(); if (had) toast("Este dispositivo se ha desconectado de la nube. Tu cuenta sigue guardada: para borrarla, entra y usa «Borrar mi cuenta»."); }, 60);
}, true);
/* Enganches: al arrancar, al cambiar de persona y al volver a la app */
const cGo = goLocal; goLocal = function (note) { cGo(note); cLoad(); cSet(cState); cNote(); if (cs && cs.token) cSync(true); };
const cRender = render; render = function () { cRender(); cCta(); if (csFor !== null && csFor !== users.current) { cLoad(); cSet(cState); cNote(); if (cs && cs.token) cSync(true); } };
document.addEventListener("visibilitychange", () => { if (!document.hidden && cs && cs.token && Date.now() - (cs.at || 0) > 60000) cSync(true); });
window.addEventListener("online", () => { if (cs && cs.token) cSync(true); });
