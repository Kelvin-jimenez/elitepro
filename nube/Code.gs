/**
 * Elitepro · servidor de datos sobre una hoja de cálculo de Google.
 *
 * Es un proyecto de Apps Script SUELTO (script.google.com > Proyecto nuevo) que abre la hoja por su identificador, guardado en
 * la propiedad `sheet_id`. Si se pone dentro de la hoja (Extensiones > Apps Script) también funciona, pero ahí Google servía
 * mal las respuestas de la aplicación web: por eso se sacó fuera.
 * Además envía un único tipo de correo: el código para cambiar una contraseña olvidada, al correo de esa cuenta.
 *
 * Qué guarda: una fila por usuario con su correo, las fechas, el consentimiento que dio y sus
 * datos CIFRADOS. El cifrado se hace en el dispositivo del usuario; aquí nunca llega nada legible
 * (ni contraseñas, ni comidas, ni peso, ni datos de salud).
 *
 * Amigos: cada usuario tiene además un nombre visible, una clave pública y su «perfil para amigos» (foto, entrenos y comidas)
 * CIFRADO con una llave que solo tienen él y los amigos que ha aceptado. Aquí se guardan las solicitudes (con el correo que
 * se escribió) y las amistades, pero ni el administrador ni el entrenador pueden leer lo que se comparte.
 */
const POLICY = "1";            // versión de la política de privacidad que se acepta al registrarse
const CHUNK = 40000;           // una celda admite 50.000 caracteres: los datos se parten en trozos
const MAX_BLOB = 3000000;      // tope por usuario (unos años de uso)
const TZ = "Europe/Madrid";
const USERS = "usuarios", INVITES = "invitaciones";
const HEAD_U = ["id", "correo", "alta", "último acceso", "consentimiento", "rev", "trozos", "claves (no tocar)", "datos cifrados →"];
const HEAD_I = ["código", "creado", "usado por", "usado el"];
const SOCIAL = "amigos_perfiles", FRIENDS = "amigos_relaciones";
const HEAD_S = ["id", "nombre visible", "clave pública", "llave privada cifrada (no tocar)", "llave de amigos cifrada (no tocar)", "actualizado", "perfil para amigos (cifrado)"];
const HEAD_F = ["de (id)", "para (correo)", "para (id)", "estado", "creada", "llave de «de» para «para»", "llave de «para» para «de»"];
const MAX_FEED = 48000, B64 = /^[A-Za-z0-9+\/=]+$/, EMAIL_RE = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}$/;

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
function ss_() { var id = props_().getProperty("sheet_id"); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) {
  var ss = ss_(), s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    var head = name === USERS ? HEAD_U : name === SOCIAL ? HEAD_S : name === FRIENDS ? HEAD_F : HEAD_I;
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
/* IA: el servidor hace de puente con la API de Anthropic, para que la clave no salga de aquí. Límites por persona y en total, al día. */
var AI_MODEL = "claude-haiku-4-5-20251001", AI_PER_USER = 60, AI_PER_DAY = 600;
function aiOn_() { return !!props_().getProperty("ai_key"); }
function aiCount_(name, max) {
  var p = props_(), day = now_().slice(0, 10), raw = String(p.getProperty(name) || "").split("|"), n = raw[0] === day ? Number(raw[1]) || 0 : 0;
  if (n >= max) fail_("limite_ia");
  p.setProperty(name, day + "|" + (n + 1));
}
/* ---------- amigos ---------- */
function soc_(id) {
  var s = sheet_(SOCIAL), row = find_(s, 1, id); if (!row) return { s: s, row: 0, id: id, name: "", pub: "", skw: "", fks: "", feed: "" };
  var v = s.getRange(row, 1, 1, 7).getValues()[0];
  return { s: s, row: row, id: id, name: String(v[1]), pub: String(v[2]), skw: String(v[3]).slice(2), fks: String(v[4]).slice(2), at: String(v[5]), feed: String(v[6]).slice(2) };
}
function socPut_(x) {
  if (!x.row) x.row = Math.max(x.s.getLastRow(), 1) + 1;
  x.s.getRange(x.row, 1, 1, 7).setNumberFormat("@").setValues([[x.id, x.name, x.pub, "k:" + x.skw, "k:" + x.fks, now_(), "f:" + (x.feed || "")]]);
}
function name_(v) { return String(v || "").replace(/[\u0000-\u001f<>]/g, "").replace(/^[=+\-@\s]+/, "").trim().slice(0, 40) || "Sin nombre"; }
function frRows_() {
  var s = sheet_(FRIENDS), last = s.getLastRow(), rows = last > 1 ? s.getRange(2, 1, last - 1, 7).getValues() : [];
  return { s: s, rows: rows.map(function (r, i) { return { row: i + 2, a: String(r[0]), email: String(r[1]), b: String(r[2]), st: String(r[3]), at: String(r[4]), wa: String(r[5]).slice(2), wb: String(r[6]).slice(2) }; }).filter(function (f) { return f.a; }) };
}
function frPut_(s, f) { s.getRange(f.row, 1, 1, 7).setNumberFormat("@").setValues([[f.a, f.email, f.b, f.st, f.at, "k:" + (f.wa || ""), "k:" + (f.wb || "")]]); }
function rid_(f) { return sha_(f.a + "|" + f.email + "|" + f.at).slice(0, 16); }
function frDel_(F, list) { list.map(function (f) { return f.row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { F.s.deleteRow(r); }); }
/* Al borrar una cuenta se borran también su perfil para amigos, sus amistades y las solicitudes que mandó o le mandaron */
function socForget_(id, email) {
  var s = sheet_(SOCIAL), row = find_(s, 1, id); if (row) s.deleteRow(row);
  var F = frRows_(); frDel_(F, F.rows.filter(function (f) { return f.a === id || f.b === id || (f.st === "pend" && f.email === email); }));
}
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
    var s = sheet_(USERS), had = find_(s, 2, email);
    if (had) { // el correo ya tiene cuenta: si es el mismo registro repetido (se perdió la respuesta), se entra en ella
      var prev = read_(s, had, false); if (!same_(sha_(prev.sec.salt + auth), prev.sec.hash)) fail_("existe");
      return { token: session_(prev), rev: prev.rev, existing: true, ai: aiOn_() };
    }
    var inv = sheet_(INVITES), irow = find_(inv, 1, code);
    if (!irow || String(inv.getRange(irow, 3).getValue())) bad_("reg", "invitacion", 20);
    var salt = rand_().slice(0, 32), u = { row: Math.max(s.getLastRow(), 1) + 1, id: rand_().slice(0, 20), email: email, created: now_(), seen: now_(), consent: consent_(b.consent), rev: 1, n: 0,
      sec: { salt: salt, hash: sha_(salt + auth), tv: 0, wrapUser: b.wrapUser, wrapCoach: b.wrapCoach, kid: b.kid, health: !!b.consent.health } };
    write_(s, u, b.blob);
    inv.getRange(irow, 3, 1, 2).setNumberFormat("@").setValues([[email, now_()]]);
    return { token: session_(u), rev: 1, ai: aiOn_() };
  },

  login: function (b) {
    var email = str_(b.email, 120), auth = str_(b.auth, 64, /^[0-9a-f]{64}$/), key = "log:" + sha_(email).slice(0, 24);
    var s = sheet_(USERS), row = find_(s, 2, email); if (!row) bad_(key, "credenciales");
    var u = read_(s, row, true); if (!same_(sha_(u.sec.salt + auth), u.sec.hash)) bad_(key, "credenciales");
    return { token: session_(u), rev: u.rev, blob: u.blob, wrapUser: u.sec.wrapUser, kid: u.sec.kid, ckid: ckid_(), health: !!u.sec.health, ai: aiOn_() };
  },

  load: function (b) { var x = user_(b.token, true); return { rev: x.u.rev, blob: x.u.blob, kid: x.u.sec.kid, ckid: ckid_(), health: !!x.u.sec.health, ai: aiOn_() }; },

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

  /* Contraseña olvidada, paso 1: se envía al correo de la cuenta un código de 6 cifras que vale 15 minutos.
     Contesta igual exista o no la cuenta, para no revelar quién está registrado. Máximo 3 códigos por correo cada media hora. */
  reset_ask: function (b) {
    var email = str_(b.email, 120), c = CacheService.getScriptCache(), key = "rst:" + sha_(email).slice(0, 24), n = Number(c.get(key) || 0);
    if (n >= 3) return {};
    c.put(key, String(n + 1), 1800);
    var s = sheet_(USERS), row = find_(s, 2, email); if (!row) return {};
    var u = read_(s, row, false), code = ("000000" + (parseInt(rand_().slice(0, 8), 16) % 1000000)).slice(-6), salt = rand_().slice(0, 16);
    u.sec.reset = { salt: salt, hash: sha_(salt + code), exp: Date.now() + 15 * 60000, n: 0 };
    write_(s, u, null);
    try {
      MailApp.sendEmail(email, "Elitepro: tu código para cambiar la contraseña",
        "Tu código para poner una contraseña nueva en Elitepro es:\n\n    " + code + "\n\nVale durante 15 minutos y solo una vez.\n\nSi no lo has pedido tú, no hagas nada: tu contraseña sigue siendo la misma.");
    } catch (err) { console.error("Elitepro · no se pudo enviar el correo: " + err); fail_("correo"); }
    return {};
  },

  /* Paso 2: con el código se pone la contraseña nueva. Las sesiones abiertas dejan de valer.
     Si el dispositivo conserva la llave de los datos, solo la vuelve a guardar protegida con la contraseña nueva (`wrapUser`).
     Si no la tiene, manda una llave y unos datos nuevos (`blob`): lo que había en la nube no se puede leer sin la contraseña antigua. */
  reset_do: function (b) {
    var email = str_(b.email, 120), code = str_(b.code, 20).replace(/\D/g, ""), auth = str_(b.auth, 64, /^[0-9a-f]{64}$/), key = "rsd:" + sha_(email).slice(0, 24);
    var s = sheet_(USERS), row = find_(s, 2, email); if (!row) bad_(key, "codigo", 5);
    var u = read_(s, row, true), r = u.sec.reset;
    if (!r || r.exp < Date.now() || r.n >= 5) bad_(key, "codigo", 5);
    if (!same_(sha_(r.salt + code), r.hash)) { r.n++; write_(s, u, null); bad_(key, "codigo", 5); }
    var blob = null;
    if (typeof b.blob === "string") {
      if (b.blob.length > MAX_BLOB) fail_("datos");
      u.sec.wrapCoach = str_(b.wrapCoach, 2000); u.sec.kid = str_(b.kid, 80); u.sec.health = false; u.consent = consent_({ health: false }) + " · contraseña restablecida"; u.rev++; blob = b.blob;
    }
    u.sec.salt = rand_().slice(0, 32); u.sec.hash = sha_(u.sec.salt + auth); u.sec.tv = (u.sec.tv || 0) + 1; u.sec.wrapUser = str_(b.wrapUser, 400); delete u.sec.reset;
    u.seen = now_(); write_(s, u, blob);
    return { token: session_(u), rev: u.rev, health: !!u.sec.health, kid: u.sec.kid, ckid: ckid_(), ai: aiOn_() };
  },

  /* Derecho de supresión: el usuario borra su cuenta y todos sus datos del servidor */
  remove: function (b) {
    var x = user_(b.token, false), u = x.u, auth = str_(b.auth, 64, /^[0-9a-f]{64}$/);
    if (!same_(sha_(u.sec.salt + auth), u.sec.hash)) bad_("pw:" + u.id, "credenciales");
    x.s.deleteRow(u.row); forget_(u.email); props_().deleteProperty("ai_n:" + u.id); socForget_(u.id, u.email);
    return {};
  },

  /* ---------- amigos ---------- */
  /* Lo mío: clave pública, llave privada cifrada con mi contraseña y llave de amigos cifrada para mí mismo */
  soc_me: function (b) { var x = user_(b.token, false), m = soc_(x.u.id); return m.row ? { pub: m.pub, skw: m.skw, fks: m.fks, name: m.name } : {}; },
  /* Alta o cambio de llaves. Si cambia la clave pública, las llaves que me habían dado mis amigos ya no valen: se borran y las vuelven a hacer */
  soc_set: function (b) {
    var x = user_(b.token, false), m = soc_(x.u.id), pub = str_(b.pub, 1000), changed = !!m.row && m.pub !== pub;
    m.name = name_(b.name); m.pub = pub; m.skw = str_(b.skw, 2000, B64); m.fks = str_(b.fks, 400, B64); if (changed || !m.row) m.feed = ""; socPut_(m);
    if (changed) { var F = frRows_(); F.rows.forEach(function (f) { if (f.st === "ok" && (f.a === m.id || f.b === m.id)) { f.wa = ""; f.wb = ""; frPut_(F.s, f); } }); }
    return {};
  },
  /* Solicitud de amistad por correo. Contesta igual exista o no esa cuenta, para no revelar quién está registrado */
  fr_req: function (b) {
    var x = user_(b.token, false), me = x.u.id, email = str_(String(b.email || "").trim().toLowerCase(), 120, EMAIL_RE);
    if (email === x.u.email) fail_("tu_correo");
    if (!soc_(me).row) fail_("sin_amigos");
    var F = frRows_(), s = sheet_(USERS), row = find_(s, 2, email), tid = row ? String(s.getRange(row, 1).getValue()) : "";
    if (F.rows.filter(function (f) { return f.a === me && f.st === "pend"; }).length >= 30) fail_("demasiadas");
    var dup = F.rows.some(function (f) { return (f.a === me && (f.email === email || (tid && f.b === tid))) || (tid && f.a === tid && (f.b === me || f.email === x.u.email)); });
    if (!dup) frPut_(F.s, { row: Math.max(F.s.getLastRow(), 1) + 1, a: me, email: email, b: "", st: "pend", at: now_() + ":" + rand_().slice(0, 6), wa: "", wb: "" });
    return {};
  },
  /* Mis amigos (con su perfil cifrado y la llave que me han dado para abrirlo), las solicitudes que me han hecho y las que he hecho */
  fr_list: function (b) {
    var x = user_(b.token, false), me = x.u.id, F = frRows_(), out = { friends: [], incoming: [], outgoing: [] };
    F.rows.forEach(function (f) {
      if (f.st === "pend" && f.a === me) out.outgoing.push({ rid: rid_(f), email: f.email });
      else if (f.st === "pend" && f.email === x.u.email) { var o = soc_(f.a); if (o.row) out.incoming.push({ rid: rid_(f), id: f.a, name: o.name, pub: o.pub }); }
      else if (f.st === "ok" && (f.a === me || f.b === me)) {
        var other = f.a === me ? f.b : f.a, p = soc_(other); if (!p.row) return;
        out.friends.push({ id: other, name: p.name, pub: p.pub, wrap: f.a === me ? f.wb : f.wa, mine: !!(f.a === me ? f.wa : f.wb), feed: p.feed, at: p.at });
      }
    });
    return out;
  },
  /* Aceptar (con la llave de mi perfil para quien me lo pidió) o rechazar una solicitud */
  fr_ans: function (b) {
    var x = user_(b.token, false), F = frRows_(), rid = str_(b.rid, 40), f = F.rows.filter(function (r) { return r.st === "pend" && r.email === x.u.email && rid_(r) === rid; })[0];
    if (!f) fail_("no_existe");
    if (b.ok !== true) { frDel_(F, [f]); return {}; }
    if (!soc_(x.u.id).row) fail_("sin_amigos");
    f.b = x.u.id; f.st = "ok"; f.wb = str_(b.wrap, 400, B64); frPut_(F.s, f);
    return {};
  },
  /* Mis llaves para mis amigos (al aceptar ellos, o al cambiar mi llave tras dejar a alguien); de paso, mi llave para mí y mi perfil */
  fr_wrap: function (b) {
    var x = user_(b.token, false), me = x.u.id, w = b.wraps && typeof b.wraps === "object" ? b.wraps : {}, F = frRows_();
    F.rows.forEach(function (f) {
      if (f.st !== "ok" || (f.a !== me && f.b !== me)) return; var other = f.a === me ? f.b : f.a;
      if (Object.prototype.hasOwnProperty.call(w, other)) { var v = str_(w[other], 400, B64); if (f.a === me) f.wa = v; else f.wb = v; frPut_(F.s, f); }
    });
    if (b.fks || typeof b.feed === "string") { var m = soc_(me); if (!m.row) fail_("sin_amigos"); if (b.fks) m.fks = str_(b.fks, 400, B64); if (typeof b.feed === "string") { if (b.feed.length > MAX_FEED || (b.feed && !B64.test(b.feed))) fail_("datos"); m.feed = b.feed; } socPut_(m); }
    return {};
  },
  /* Dejar de ser amigos, cancelar una solicitud enviada */
  fr_del: function (b) {
    var x = user_(b.token, false), me = x.u.id, F = frRows_(), id = String(b.id || ""), rid = String(b.rid || "");
    frDel_(F, F.rows.filter(function (f) { return (id && f.st === "ok" && ((f.a === me && f.b === id) || (f.b === me && f.a === id))) || (rid && f.a === me && rid_(f) === rid); }));
    return {};
  },
  /* Mi perfil para amigos, ya cifrado en el dispositivo, y el nombre visible */
  feed_set: function (b) {
    var x = user_(b.token, false), m = soc_(x.u.id); if (!m.row) fail_("sin_amigos");
    if (typeof b.feed !== "string" || b.feed.length > MAX_FEED || !B64.test(b.feed)) fail_("datos");
    m.feed = b.feed; if (b.name) m.name = name_(b.name); socPut_(m);
    return {};
  },

  /* IA para quien tiene la sesión abierta: reenvía la petición (texto y, si acaso, fotos o un PDF) a la API de Anthropic y devuelve el texto.
     No guarda nada de lo que se pregunta ni de lo que se contesta. */
  ai: function (b) {
    var x = user_(b.token, false), p = props_(), key = p.getProperty("ai_key"); if (!key) fail_("sin_ia");
    if (!Array.isArray(b.messages) || !b.messages.length || b.messages.length > 12) fail_("datos");
    var chars = 0, imgs = 0, docs = 0, msgs = b.messages.map(function (m) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || !Array.isArray(m.content) || !m.content.length) fail_("datos");
      return { role: m.role, content: m.content.map(function (c) {
        if (c && c.type === "text") { var t = str_(c.text, 20000); chars += t.length; return { type: "text", text: t }; }
        if (c && c.type === "document" && m.role === "user") { docs++; return { type: "document", source: { type: "base64", media_type: str_(c.media_type, 20, /^application\/pdf$/), data: str_(c.data, 6000000, /^[A-Za-z0-9+\/=]+$/) } }; }
        if (c && c.type === "image" && m.role === "user") { imgs++; return { type: "image", source: { type: "base64", media_type: str_(c.media_type, 20, /^image\/(jpeg|png|webp)$/), data: str_(c.data, 2000000, /^[A-Za-z0-9+\/=]+$/) } }; }
        fail_("datos");
      }) };
    });
    if (chars > 30000 || imgs > 4 || docs > 2 || msgs[0].role !== "user") fail_("datos");
    aiCount_("ai_n:" + x.u.id, Number(p.getProperty("ai_max_user")) || AI_PER_USER); aiCount_("ai_day", Number(p.getProperty("ai_max_day")) || AI_PER_DAY);
    var body = { model: p.getProperty("ai_model") || AI_MODEL, max_tokens: Math.max(100, Math.min(Number(b.max) || 1000, 4000)), messages: msgs };
    if (typeof b.system === "string" && b.system) body.system = str_(b.system, 8000);
    var res; try { res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", { method: "post", contentType: "application/json", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, payload: JSON.stringify(body), muteHttpExceptions: true }); }
    catch (err) { console.error("Elitepro · IA sin respuesta: " + err); fail_("ia_ocupada"); }
    var code = res.getResponseCode(), out; try { out = JSON.parse(res.getContentText()); } catch (err) { out = null; }
    if (code !== 200 || !out || !Array.isArray(out.content)) {
      console.error("Elitepro · IA " + code + ": " + String(res.getContentText()).slice(0, 300));
      fail_(code === 429 || code === 529 ? "ia_ocupada" : code === 401 || code === 403 ? "sin_ia" : "ia");
    }
    return { text: out.content.filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join("") };
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
    s.deleteRow(row); forget_(email); props_().deleteProperty("ai_n:" + b.id); socForget_(String(b.id), email);
    return {};
  }
};

/* ---------- entrada ---------- */
/* Solo las operaciones que escriben en la hoja cogen turno, y esperan poco: si otra petición lo tiene, se contesta
   «ocupado» y la app lo reintenta. Las lecturas no esperan a nadie, así una petición atascada no deja fuera a los demás. */
var WRITES = { register: 1, save: 1, passwd: 1, remove: 1, reset_ask: 1, reset_do: 1, a_setup: 1, a_invite: 1, a_delete: 1, soc_set: 1, fr_req: 1, fr_ans: 1, fr_wrap: 1, fr_del: 1, feed_set: 1 };
function doPost(e) {
  var out, slow = false, lock = null, t0 = Date.now(), name = "?";
  try {
    var b = JSON.parse(e.postData.contents); name = String(b.op);
    if (!Object.prototype.hasOwnProperty.call(OPS, name)) fail_("op");
    if (WRITES[name]) { lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) { lock = null; fail_("ocupado"); } }
    out = OPS[name](b) || {}; out.ok = true;
    if (WRITES[name]) SpreadsheetApp.flush(); // lo escrito queda en la hoja antes de soltar el turno
  } catch (err) {
    var code = err && err.code ? err.code : "error";
    if (code === "error") console.error("Elitepro · " + name + ": " + (err && err.stack ? err.stack : err)); // se ve en Ejecuciones
    out = { ok: false, err: code }; slow = !!(err && err.slow);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (x) { /* ya suelto */ } }
  }
  var ms = Date.now() - t0; if (ms > 5000) console.warn("Elitepro · " + name + " tardó " + ms + " ms");
  if (slow) Utilities.sleep(3000);
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return ContentService.createTextOutput("Elitepro: servicio activo."); }

/**
 * Ejecuta esta función desde el editor cuando publiques una versión que pida permisos nuevos (enviar correo
 * para los códigos de «He olvidado la contraseña», conectar con la API de la IA). Solo sirve para concederlos: no cambia nada.
 */
function autorizarPermisos() {
  Logger.log("Correo: quedan " + MailApp.getRemainingDailyQuota() + " envíos hoy.");
  Logger.log("Conexión exterior: " + UrlFetchApp.fetch("https://api.anthropic.com/", { muteHttpExceptions: true }).getResponseCode());
  Logger.log("IA: " + (aiOn_() ? "hay clave puesta." : "falta la clave (propiedad ai_key)."));
  Logger.log("Hoja: " + ss_().getName());
}

/**
 * Mudanza de un proyecto a otro (por ejemplo, del que iba dentro de la hoja al suelto): los ajustes y las llaves viven en las
 * propiedades del proyecto y no se copian solos. `exportarAjustes` (en el proyecto viejo) los deja en una pestaña oculta de la
 * hoja; `importarAjustes` (en el nuevo, con `sheet_id` ya puesto) los recoge y borra la pestaña. Nadie tiene que verlos ni copiarlos a mano.
 */
function exportarAjustes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName("_ajustes") || ss.insertSheet("_ajustes"), all = props_().getProperties();
  delete all.sheet_id; sh.hideSheet(); sh.getRange(1, 1).setNumberFormat("@").setValue(JSON.stringify(all));
  Logger.log("Ajustes dejados en la hoja para la mudanza: " + Object.keys(all).filter(function (k) { return k.indexOf("ai_n:") !== 0; }).join(", "));
}
function importarAjustes() {
  var ss = ss_(), sh = ss.getSheetByName("_ajustes"); if (!sh) { Logger.log("No hay ajustes que traer: ejecuta antes exportarAjustes en el proyecto viejo."); return; }
  var all = JSON.parse(String(sh.getRange(1, 1).getValue())); delete all.sheet_id;
  props_().setProperties(all, false); ss.deleteSheet(sh);
  Logger.log("Ajustes traídos: " + Object.keys(all).filter(function (k) { return k.indexOf("ai_n:") !== 0; }).join(", ") + ". Hoja: " + ss.getName());
}

/**
 * Ejecuta esta función desde el editor para comprobar que la clave de la IA funciona: hace una pregunta mínima
 * (cuesta una fracción de céntimo) y escribe el resultado en el registro. No cambia nada.
 */
function probarIA() {
  var p = props_(), key = p.getProperty("ai_key"), model = p.getProperty("ai_model") || AI_MODEL;
  if (!key) { Logger.log("Falta la clave (propiedad ai_key)."); return; }
  var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", { method: "post", contentType: "application/json", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({ model: model, max_tokens: 30, messages: [{ role: "user", content: "Responde solo con la palabra: funciona" }] }), muteHttpExceptions: true });
  var code = res.getResponseCode(), out = null; try { out = JSON.parse(res.getContentText()); } catch (err) { out = null; }
  Logger.log(code === 200 && out && out.content ? "La IA contesta (" + model + "): " + out.content[0].text
    : "La IA NO contesta. Código " + code + ": " + (out && out.error ? out.error.type + " · " + out.error.message : "sin detalle"));
}

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
