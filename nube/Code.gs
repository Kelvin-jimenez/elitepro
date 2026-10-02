/**
 * Elitepro · servidor de datos sobre una hoja de cálculo de Google.
 *
 * Va dentro de una hoja de cálculo (Extensiones > Apps Script) y solo puede tocar ESA hoja:
 * @OnlyCurrentDoc
 *
 * Qué guarda: una fila por usuario con su correo, las fechas, el consentimiento que dio y sus
 * datos CIFRADOS. El cifrado se hace en el dispositivo del usuario; aquí nunca llega nada legible
 * (ni contraseñas, ni comidas, ni peso, ni datos de salud).
 */
const POLICY = "1";            // versión de la política de privacidad que se acepta al registrarse
const CHUNK = 40000;           // una celda admite 50.000 caracteres: los datos se parten en trozos
const MAX_BLOB = 3000000;      // tope por usuario (unos años de uso)
const TZ = "Europe/Madrid";
const USERS = "usuarios", INVITES = "invitaciones";
const HEAD_U = ["id", "correo", "alta", "último acceso", "consentimiento", "rev", "trozos", "claves (no tocar)", "datos cifrados →"];
const HEAD_I = ["código", "creado", "usado por", "usado el"];

/* ---------- utilidades ---------- */
function props_() { return PropertiesService.getScriptProperties(); }
function now_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"); }
function hex_(bytes) { return bytes.map(function (b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join(""); }
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function rand_() { return sha_(Utilities.getUuid() + "|" + Utilities.getUuid() + "|" + Date.now()); }
function secret_() { var p = props_(), s = p.getProperty("secret"); if (!s) { s = rand_() + rand_(); p.setProperty("secret", s); } return s; }
function sign_(s) { return hex_(Utilities.computeHmacSha256Signature(s, secret_())); }
function same_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function fail_(code) { var e = new Error(code); e.code = code; throw e; }
function str_(v, max, re) { if (typeof v !== "string" || !v || v.length > max || (re && !re.test(v))) fail_("datos"); return v; }
function token_(who, hours) { var body = who + "." + (Date.now() + hours * 3600000); return body + "." + sign_(body); }
function check_(tok) {
  var p = String(tok || "").split("."); if (p.length !== 3 || !same_(sign_(p[0] + "." + p[1]), p[2]) || Number(p[1]) < Date.now()) fail_("sesion");
  return p[0];
}
/* Fallo de contraseña o de código: se cuentan en ventanas fijas de 10 minutos y, pasado el tope, cada respuesta se retrasa.
   No se bloquea a nadie (así un tercero no puede dejar fuera al dueño de la cuenta), pero probar claves en serie deja de salir a cuenta. */
function bad_(key, code, max) {
  var c = CacheService.getScriptCache(), p = String(c.get(key) || "").split("|"), now = Date.now(), n = Number(p[0]) || 0, t0 = Number(p[1]) || 0;
  if (!t0 || now - t0 > 600000) { n = 0; t0 = now; }
  n++; c.put(key, n + "|" + t0, Math.max(1, Math.ceil((t0 + 600000 - now) / 1000)));
  var e = new Error(code); e.code = code; e.slow = n > (max || 10); throw e;
}

/* ---------- la hoja ---------- */
function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    var head = name === USERS ? HEAD_U : HEAD_I;
    s.getRange(1, 1, s.getMaxRows(), s.getMaxColumns()).setNumberFormat("@"); // todo como texto: nada se convierte en número, fecha o fórmula
    s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    s.setFrozenRows(1);
  }
  return s;
}
function find_(s, col, value) {
  var last = s.getLastRow(); if (last < 2) return 0;
  var v = s.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === value) return i + 2;
  return 0;
}
function read_(s, row, withBlob) {
  var h = s.getRange(row, 1, 1, 8).getValues()[0], n = Number(h[6]) || 0, blob = "";
  if (withBlob && n) blob = s.getRange(row, 9, 1, n).getValues()[0].map(function (x) { return String(x).slice(2); }).join("");
  return { row: row, id: String(h[0]), email: String(h[1]), created: String(h[2]), seen: String(h[3]), consent: String(h[4]), rev: Number(h[5]) || 0, n: n, sec: JSON.parse(String(h[7]).slice(2)), blob: blob };
}
function write_(s, u, blob) {
  var chunks = [], old = u.n || 0;
  if (blob != null) { for (var i = 0; i < blob.length; i += CHUNK) chunks.push("b:" + blob.slice(i, i + CHUNK)); u.n = chunks.length; }
  var vals = [u.id, u.email, u.created, u.seen, u.consent, String(u.rev), String(u.n || 0), "k:" + JSON.stringify(u.sec)];
  if (blob != null) { vals = vals.concat(chunks); for (var j = chunks.length; j < old; j++) vals.push(""); } // borra los trozos que sobren
  var max = s.getMaxColumns(); if (vals.length > max) s.insertColumnsAfter(max, vals.length - max);
  s.getRange(u.row, 1, 1, vals.length).setNumberFormat("@").setValues([vals]);
}
function consent_(c) { return "política v" + POLICY + " · " + now_() + " · mayor de edad: sí · datos de salud: " + (c && c.health ? "sí" : "no"); }
/* La sesión lleva la versión de la contraseña: al cambiarla, las sesiones anteriores dejan de valer */
function user_(tok, withBlob) {
  var who = check_(tok).split("~"); if (who.length !== 2) fail_("sesion");
  var s = sheet_(USERS), row = find_(s, 1, who[0]); if (!row) fail_("sesion");
  var u = read_(s, row, withBlob); if (String(u.sec.tv || 0) !== who[1]) fail_("sesion");
  return { s: s, u: u };
}
function session_(u) { return token_(u.id + "~" + (u.sec.tv || 0), 24 * 30); }
function admin_(tok) { if (check_(tok) !== "admin") fail_("sesion"); }
function forget_(email) { var inv = sheet_(INVITES), row = find_(inv, 3, email); if (row) inv.getRange(row, 3, 1, 1).setNumberFormat("@").setValues([["(cuenta borrada)"]]); }
function coach_() { var raw = props_().getProperty("coach"); return raw ? JSON.parse(raw) : null; }
function ckid_() { var c = coach_(); return c ? c.kid : ""; }

/* ---------- operaciones de los usuarios ---------- */
var OPS = {
  /* clave pública del entrenador: con ella cada dispositivo cifra una copia de su llave para él */
  pub: function () { var c = coach_(); if (!c) fail_("sin_configurar"); return { pub: c.pub, kid: c.kid, policy: POLICY }; },

  register: function (b) {
    var email = str_(b.email, 120, /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}$/), auth = str_(b.auth, 64, /^[0-9a-f]{64}$/), code = str_(b.invite, 40).toUpperCase().replace(/\s+/g, "");
    if (!/^EP-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) bad_("reg", "invitacion", 20);
    if (!b.consent || b.consent.adult !== true || b.consent.terms !== true) fail_("consentimiento");
    str_(b.wrapUser, 400); str_(b.wrapCoach, 2000); str_(b.kid, 80); if (typeof b.blob !== "string" || b.blob.length > MAX_BLOB) fail_("datos");
    var s = sheet_(USERS), inv = sheet_(INVITES), irow = find_(inv, 1, code);
    if (!irow || String(inv.getRange(irow, 3).getValue())) bad_("reg", "invitacion", 20);
    if (find_(s, 2, email)) fail_("existe");
    var salt = rand_().slice(0, 32), u = { row: Math.max(s.getLastRow(), 1) + 1, id: rand_().slice(0, 20), email: email, created: now_(), seen: now_(), consent: consent_(b.consent), rev: 1, n: 0,
      sec: { salt: salt, hash: sha_(salt + auth), tv: 0, wrapUser: b.wrapUser, wrapCoach: b.wrapCoach, kid: b.kid, health: !!b.consent.health } };
    write_(s, u, b.blob);
    inv.getRange(irow, 3, 1, 2).setNumberFormat("@").setValues([[email, now_()]]);
    return { token: session_(u), rev: 1 };
  },

  login: function (b) {
    var email = str_(b.email, 120), auth = str_(b.auth, 64, /^[0-9a-f]{64}$/), key = "log:" + sha_(email).slice(0, 24);
    var s = sheet_(USERS), row = find_(s, 2, email); if (!row) bad_(key, "credenciales");
    var u = read_(s, row, true); if (!same_(sha_(u.sec.salt + auth), u.sec.hash)) bad_(key, "credenciales");
    u.seen = now_(); write_(s, u, null);
    return { token: session_(u), rev: u.rev, blob: u.blob, wrapUser: u.sec.wrapUser, kid: u.sec.kid, ckid: ckid_(), health: !!u.sec.health };
  },

  load: function (b) { var x = user_(b.token, true); return { rev: x.u.rev, blob: x.u.blob, kid: x.u.sec.kid, ckid: ckid_(), health: !!x.u.sec.health }; },

  /* Guarda solo si el dispositivo partía de la última versión; si no, devuelve la que hay para que las junte */
  save: function (b) {
    if (typeof b.blob !== "string" || b.blob.length > MAX_BLOB) fail_("datos");
    var x = user_(b.token, true), u = x.u;
    var mine = b.hset === true && typeof b.health === "boolean"; // este dispositivo es el que cambia el consentimiento de salud
    /* Un dispositivo que parte de datos viejos, o que no sabe que el consentimiento de salud cambió, no guarda: recibe lo actual y lo junta */
    if (Number(b.rev) !== u.rev || (!mine && typeof b.health === "boolean" && b.health !== !!u.sec.health)) return { conflict: true, rev: u.rev, blob: u.blob, health: !!u.sec.health };
    if (b.wrapCoach) { u.sec.wrapCoach = str_(b.wrapCoach, 2000); u.sec.kid = str_(b.kid, 80); }
    if (mine && b.health !== !!u.sec.health) { u.sec.health = b.health; u.consent = consent_({ health: b.health }); }
    u.rev++; u.seen = now_(); write_(x.s, u, b.blob);
    return { rev: u.rev, health: !!u.sec.health };
  },

  passwd: function (b) {
    var x = user_(b.token, false), u = x.u, auth = str_(b.auth, 64, /^[0-9a-f]{64}$/), next = str_(b.next, 64, /^[0-9a-f]{64}$/);
    if (!same_(sha_(u.sec.salt + auth), u.sec.hash)) bad_("pw:" + u.id, "credenciales");
    u.sec.salt = rand_().slice(0, 32); u.sec.hash = sha_(u.sec.salt + next); u.sec.wrapUser = str_(b.wrapUser, 400); u.sec.tv = (u.sec.tv || 0) + 1; write_(x.s, u, null);
    return { token: session_(u) };
  },

  /* Derecho de supresión: el usuario borra su cuenta y todos sus datos del servidor */
  remove: function (b) {
    var x = user_(b.token, false), u = x.u, auth = str_(b.auth, 64, /^[0-9a-f]{64}$/);
    if (!same_(sha_(u.sec.salt + auth), u.sec.hash)) bad_("pw:" + u.id, "credenciales");
    x.s.deleteRow(u.row); forget_(u.email);
    return {};
  },

  /* ---------- operaciones del entrenador ---------- */
  a_hello: function () { var a = props_().getProperty("admin"); return { configured: !!a, salt: a ? JSON.parse(a).salt : "" }; },

  /* Puesta en marcha: solo con el código que genera prepararElitepro(), que sirve una vez */
  a_setup: function (b) {
    var p = props_(), code = p.getProperty("setup"); if (!code || !same_(code, str_(b.setup, 80))) bad_("setup", "codigo");
    var auth = str_(b.auth, 64, /^[0-9a-f]{64}$/), salt = rand_().slice(0, 32);
    p.setProperty("admin", JSON.stringify({ salt: str_(b.salt, 80), s2: salt, hash: sha_(salt + auth) }));
    p.setProperty("coach", JSON.stringify({ pub: str_(b.pub, 4000), priv: str_(b.priv, 8000), kid: str_(b.kid, 80) }));
    p.deleteProperty("setup");
    return { token: token_("admin", 8) };
  },
  a_login: function (b) {
    var a = props_().getProperty("admin"); if (!a) fail_("sin_configurar"); a = JSON.parse(a);
    if (!same_(sha_(a.s2 + str_(b.auth, 64, /^[0-9a-f]{64}$/)), a.hash)) bad_("alog", "credenciales");
    var c = coach_();
    return { token: token_("admin", 8), priv: c.priv, pub: c.pub, kid: c.kid };
  },
  a_list: function (b) {
    admin_(b.token);
    var s = sheet_(USERS), last = s.getLastRow(), users = [], inv = sheet_(INVITES), il = inv.getLastRow();
    if (last > 1) users = s.getRange(2, 1, last - 1, 6).getValues().map(function (r) { return { id: String(r[0]), email: String(r[1]), created: String(r[2]), seen: String(r[3]), consent: String(r[4]), rev: Number(r[5]) || 0 }; });
    var invites = il > 1 ? inv.getRange(2, 1, il - 1, 4).getValues().map(function (r) { return { code: String(r[0]), created: String(r[1]), usedBy: String(r[2]), usedAt: String(r[3]) }; }) : [];
    return { users: users, invites: invites };
  },
  a_get: function (b) {
    admin_(b.token);
    var s = sheet_(USERS), row = find_(s, 1, str_(b.id, 40)); if (!row) fail_("no_existe");
    var u = read_(s, row, true);
    return { email: u.email, consent: u.consent, rev: u.rev, blob: u.blob, wrapCoach: u.sec.wrapCoach, kid: u.sec.kid, health: !!u.sec.health };
  },
  a_invite: function (b) {
    admin_(b.token);
    var n = Math.min(Math.max(Number(b.n) || 1, 1), 20), inv = sheet_(INVITES), abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = [];
    for (var i = 0; i < n; i++) {
      var h = rand_(), code = "EP";
      for (var j = 0; j < 8; j++) code += (j % 4 === 0 ? "-" : "") + abc[parseInt(h.substr(j * 2, 2), 16) % abc.length];
      out.push(code);
    }
    var first = Math.max(inv.getLastRow(), 1) + 1, stamp = now_();
    inv.getRange(first, 1, n, 4).setNumberFormat("@").setValues(out.map(function (c) { return [c, stamp, "", ""]; }));
    return { codes: out };
  },
  a_delete: function (b) {
    admin_(b.token);
    var s = sheet_(USERS), row = find_(s, 1, str_(b.id, 40)); if (!row) fail_("no_existe");
    var email = String(s.getRange(row, 2).getValue());
    s.deleteRow(row); forget_(email);
    return {};
  }
};

/* ---------- entrada ---------- */
function doPost(e) {
  var out, slow = false, lock = LockService.getScriptLock();
  try {
    var b = JSON.parse(e.postData.contents), op = OPS[String(b.op)];
    if (!op || !Object.prototype.hasOwnProperty.call(OPS, String(b.op))) fail_("op");
    lock.waitLock(25000);
    out = op(b) || {}; out.ok = true;
  } catch (err) {
    out = { ok: false, err: err && err.code ? err.code : "error" }; slow = !!(err && err.slow);
  } finally {
    try { SpreadsheetApp.flush(); } catch (x) { /* nada pendiente */ } // lo escrito queda en la hoja antes de soltar el turno
    try { lock.releaseLock(); } catch (x) { /* no estaba cogido */ }
  }
  if (slow) Utilities.sleep(3000);
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return ContentService.createTextOutput("Elitepro: servicio activo."); }

/**
 * Ejecuta esta función UNA vez desde el editor (botón Ejecutar): crea las pestañas y un código de
 * puesta en marcha de un solo uso, que se escribe en el registro de ejecución. Si olvidas la
 * contraseña de entrenador, vuelve a ejecutarla para obtener un código nuevo y repetir la puesta en marcha.
 */
function prepararElitepro() {
  sheet_(USERS); sheet_(INVITES); secret_();
  var code = rand_().slice(0, 24); props_().setProperty("setup", code);
  Logger.log("Código de puesta en marcha de Elitepro (sirve una vez, no lo compartas): " + code);
  return code;
}
