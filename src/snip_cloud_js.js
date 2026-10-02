/* ---------- Cuenta en la nube (solo versión web): copia cifrada en el servidor de Elitepro ---------- */
const CLOUD_URL = "__CLOUD_URL__", CLOUD_WHO = "__RESPONSABLE__", CLOUD_KID = "__CLOUD_KID__";
const CERR = { credenciales: "Correo o contraseña incorrectos.", invitacion: "Ese código de invitación no vale o ya se ha usado.", existe: "Ya hay una cuenta con ese correo. Usa «Ya tengo cuenta».", espera: "Demasiados intentos. Espera unos minutos y vuelve a probar.", sesion: "La sesión ha caducado. Vuelve a entrar.", sin_configurar: "La nube todavía no está en marcha.", consentimiento: "Hace falta que aceptes la política de privacidad.", datos: "Revisa los datos: hay algo que no vale.", llave: "La llave del responsable no coincide con la de esta versión de la app. No se ha enviado nada: avisa al responsable." };
const cMsg = e => CERR[e && e.code] || "No hay conexión con la nube. Inténtalo otra vez.";
const CNOTE = "Lo que apuntes se guarda solo en este navegador. Crea una cuenta en Perfil para tener una copia en la nube.";
let cs = null, csFor = null, cT = 0, cBusy = false, cAgain = false, cState = "", cMode = "";
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
/* Cada dato tiene dos partes: la de entreno y nutrición, y la de salud (condición, límites del médico, lesiones, glucosa).
   La de salud solo sale del dispositivo con consentimiento expreso. */
const cCore = (kind, o) => { if (!o) return null; const c = Object.assign({}, o); if (kind === "p") { delete c.health; delete c.injuries; } else delete c.glu; return c; };
const cHealth = (kind, o) => { if (!o) return null; if (kind === "p") return (o.health && o.health.cond) || (o.injuries || []).length ? { health: o.health, injuries: o.injuries } : null; return (o.glu || []).length ? { glu: o.glu } : null; };
const hC = (kind, o) => o ? h53(canon(cCore(kind, o))) : "";
const hH = (kind, o) => { const x = cHealth(kind, o); return x ? h53(canon(x)) : ""; };
const cOut = (me, kind, o) => (!o || me.health ? o : cCore(kind, o));
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
    return Object.assign({}, core, hp || {});
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
    if (!remote && pull) { const r = await EPC.api(CLOUD_URL, { op: "load", token: me.token }); if (r.ckid && r.ckid !== me.kid) me.rewrap = true; if (r.rev !== me.rev) remote = r; }
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
    else if (mine()) cSet(e && e.code === "llave" ? "llave" : "err");
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
<style>.chk{display:flex;gap:10px;align-items:flex-start;font-size:.9rem;color:var(--ink-2);line-height:1.4;cursor:pointer}.chk input{width:20px;height:20px;flex:0 0 auto;margin-top:1px;accent-color:var(--mark)}#cl-body a,#cl-form a{color:var(--ink);text-decoration:underline}#cl-form input[type="email"],#cl-form input[type="password"]{background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:44px;width:100%;min-width:0;color:var(--ink);font:inherit}</style>`);
$("#v-need").insertAdjacentHTML("beforeend", `<div><button class="btn ghost" type="button" data-cl="login">Ya tengo cuenta en la nube</button></div>`);
function cSet(st) {
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
    ${on ? `<label class="chk"><input type="checkbox" id="cl-health" ${cs.health ? "checked" : ""}><span>Consiento expresamente que también se guarden en la nube mis datos de salud (condición, límites del médico, glucosa y lesiones). Si lo desmarcas, se borran de la nube y se quedan solo en este dispositivo.</span></label>` : ""}
    <div class="row">${on ? `<button class="btn ghost sm" type="button" data-cl="sync">Sincronizar ahora</button><button class="btn ghost sm" type="button" data-cl="passwd">Cambiar contraseña</button>` : `<button class="btn" type="button" data-cl="login">Volver a entrar</button>`}<button class="btn ghost sm" type="button" data-cl="logout">Cerrar sesión</button>${on ? `<button class="btn ghost sm" type="button" data-cl="remove">Borrar mi cuenta</button>` : ""}</div>
    <p class="sub"><a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a> · Para descargar todos tus datos usa «Descargar copia», aquí debajo.</p>`;
}
const cFld = (id, label, type, ac, extra) => `<label class="fld">${label}<input id="${id}" type="${type}" autocomplete="${ac}" ${extra || ""} required></label>`;
function cForm(mode) {
  cMode = mode; const who = esc(CLOUD_WHO || "el responsable de Elitepro");
  $("#sh-cloud-t").textContent = { register: "Crear cuenta", login: "Entrar", passwd: "Cambiar contraseña", remove: "Borrar mi cuenta" }[mode];
  const mail = cFld("cl-email", "Correo", "email", "username", `value="${esc(cs && cs.email || "")}" maxlength="120"`);
  $("#cl-form").innerHTML = (mode === "register" ? mail + cFld("cl-pass", "Contraseña (mínimo 10 caracteres)", "password", "new-password", 'minlength="10"') + cFld("cl-pass2", "Repite la contraseña", "password", "new-password", 'minlength="10"') + cFld("cl-inv", "Código de invitación", "text", "off", 'placeholder="EP-XXXX-XXXX" maxlength="20"') +
      `<p class="sub">Con la contraseña se cifran tus datos antes de salir de este dispositivo. Guárdala bien: si la olvidas no se puede recuperar.</p>
      <label class="chk"><input type="checkbox" id="cl-terms" required><span>Tengo 18 años o más, he leído la <a href="privacidad.html" target="_blank" rel="noopener">política de privacidad</a> y acepto que mis datos de entreno y nutrición se guarden cifrados en la nube de Elitepro y que ${who} pueda verlos para hacer mi seguimiento.</span></label>
      <label class="chk"><input type="checkbox" id="cl-hc"><span>Además, consiento expresamente que se guarden y que ${who} pueda ver mis datos de salud: condición, límites del médico, glucosa y lesiones. Es opcional: si no lo marcas, esos datos no salen de este dispositivo.</span></label>`
    : mode === "login" ? mail + cFld("cl-pass", "Contraseña", "password", "current-password")
    : mode === "passwd" ? cFld("cl-pass", "Contraseña actual", "password", "current-password") + cFld("cl-new", "Contraseña nueva (mínimo 10 caracteres)", "password", "new-password", 'minlength="10"') + cFld("cl-pass2", "Repite la nueva", "password", "new-password", 'minlength="10"')
    : `<p class="sub">Se borran del servidor tu cuenta y todos tus datos. Lo que tienes en este dispositivo no se toca. No se puede deshacer.</p>` + cFld("cl-pass", "Contraseña", "password", "current-password"))
    + `<div class="row actions"><button class="btn" type="submit" id="cl-go">${{ register: "Crear cuenta", login: "Entrar", passwd: "Cambiar contraseña", remove: "Borrar mi cuenta y mis datos de la nube" }[mode]}</button></div><p id="cl-msg" class="msg" aria-live="polite"></p>`;
  openSheet("cloud");
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-cl]"); if (!t) return;
  const a = t.dataset.cl;
  if (a === "sync") return cSync(true);
  if (a === "logout") { // se quitan la sesión y la llave; queda la marca de lo ya sincronizado para juntar bien si vuelve a entrar con la misma cuenta
    clearTimeout(cT); cs = { uid: cs.uid, email: cs.email, out: true, rev: cs.rev, base: cs.base, health: cs.health, kid: cs.kid }; cStore(); cSet(""); cNote();
    return toast("Sesión cerrada. Tus datos siguen en este dispositivo.");
  }
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
  const email = (cMode === "passwd" || cMode === "remove" ? cs.email : val("cl-email")).trim().toLowerCase(), pass = val("cl-pass");
  if ((cMode === "register" || cMode === "passwd") && (cMode === "passwd" ? val("cl-new") : pass) !== val("cl-pass2")) return say("Las dos contraseñas no coinciden.", true);
  go.disabled = true; say("Un momento…");
  try {
    const k = await EPC.derive(pass, "elitepro:user:" + email);
    if (cMode === "register") {
      const pub = await cPub(), dek = EPC.rand(32);
      const me = { uid: users.current, email, token: "", dek: EPC.b64(dek), rev: 0, base: cEmpty(), health: $("#cl-hc").checked, kid: pub.kid };
      const snap = cSnap(me);
      const r = await EPC.api(CLOUD_URL, { op: "register", email, auth: k.auth, invite: val("cl-inv").trim(), consent: { adult: true, terms: $("#cl-terms").checked, health: me.health }, wrapUser: EPC.b64(await EPC.enc(k.kek, dek)), wrapCoach: await EPC.wrapFor(pub.pub, dek), kid: pub.kid, blob: await EPC.seal(dek, snap) });
      me.token = r.token; me.rev = r.rev; me.base = cHashes(me, snap); me.at = Date.now(); cs = me; csFor = me.uid; cStore();
      closeSheets(); cSet("ok"); cNote(); toast("Cuenta creada. Tus datos ya se guardan en la nube."); cTouch();
    } else if (cMode === "login") {
      const r = await EPC.api(CLOUD_URL, { op: "login", email, auth: k.auth }), dek = await EPC.dec(k.kek, EPC.unb64(r.wrapUser));
      const old = cs && cs.email === email ? cs : null;
      cs = { uid: users.current, email, token: r.token, dek: EPC.b64(dek), rev: old ? old.rev : -1, base: old ? old.base : cEmpty(), health: !!r.health, adopt: !old && !!r.health, fresh: !old || !!old.fresh, kid: r.kid, rewrap: !!(r.ckid && r.ckid !== r.kid) }; csFor = cs.uid; cStore();
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
/* «Empezar de cero» borra lo de este dispositivo, no la cuenta: antes de borrar se desconecta, para que el vaciado no se suba a la nube */
document.addEventListener("click", e => {
  if (!e.target || e.target.id !== "rs-yes" || !cs) return;
  const had = !!cs.token; clearTimeout(cT); cs = null; cStore(); cSet("");
  setTimeout(() => { cNote(); if (had) toast("Este dispositivo se ha desconectado de la nube. Tu cuenta sigue guardada: para borrarla, entra y usa «Borrar mi cuenta»."); }, 60);
}, true);
/* Enganches: al arrancar, al cambiar de persona y al volver a la app */
const cGo = goLocal; goLocal = function (note) { cGo(note); cLoad(); cSet(cState); cNote(); if (cs && cs.token) cSync(true); };
const cRender = render; render = function () { cRender(); if (csFor !== null && csFor !== users.current) { cLoad(); cSet(cState); cNote(); if (cs && cs.token) cSync(true); } };
document.addEventListener("visibilitychange", () => { if (!document.hidden && cs && cs.token && Date.now() - (cs.at || 0) > 60000) cSync(true); });
window.addEventListener("online", () => { if (cs && cs.token) cSync(true); });
