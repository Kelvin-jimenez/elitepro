/* ---------- Amigos (solo en la web, con cuenta en la nube) ----------
   Cada cuenta tiene un par de claves (ECDH P-256). La privada se guarda en el servidor cifrada con la contraseña del usuario
   (no con la llave que comparte con el entrenador), así que nadie más puede usarla. El «perfil para amigos» (foto, nombre,
   entrenos y comidas de las dos últimas semanas; nunca peso ni salud) se cifra con una llave de amigos (`fk`), y cada amigo
   aceptado recibe esa llave cifrada con la clave que comparten los dos. Al dejar a alguien, la llave se cambia. */
const SOC_EC = { name: "ECDH", namedCurve: "P-256" }, SOC_DAYS = 14, socTe = new TextEncoder(), socTd = new TextDecoder();
let socData = null, socBusy = false, socErr = "", socOpen = "", socAsk = "", socOld = false; // socOld: el servidor aún no tiene Amigos
async function socGen() {
  const kp = await EPC.sub.generateKey(SOC_EC, true, ["deriveBits"]);
  return { priv: JSON.stringify(await EPC.sub.exportKey("jwk", kp.privateKey)), pub: JSON.stringify(await EPC.sub.exportKey("jwk", kp.publicKey)) };
}
/* La llave que comparten dos personas: la misma desde los dos lados (mi privada + su pública = su privada + mi pública) */
async function socPair(privJ, pubJ, label) {
  const priv = await EPC.sub.importKey("jwk", JSON.parse(privJ), SOC_EC, false, ["deriveBits"]), pub = await EPC.sub.importKey("jwk", JSON.parse(pubJ), SOC_EC, false, []);
  const bits = await EPC.sub.deriveBits({ name: "ECDH", public: pub }, priv, 256), h = await EPC.sub.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return EPC.sub.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: socTe.encode(label) }, h, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const socWrap = async (me, pub) => EPC.b64(await EPC.enc(await socPair(me.sk, pub, "elitepro:amigos"), EPC.unb64(me.fk)));
const socName = () => ((S.profile && S.profile.name) || "").trim().slice(0, 40) || (cs && cs.email ? cs.email.split("@")[0] : "");
/* Con la contraseña a mano (al entrar, registrarse o cambiarla): recupera mis llaves o crea unas nuevas */
async function socAfterAuth(kek, me) {
  me = me || cs; if (!me || !me.token) return;
  try {
    const r = await EPC.api(CLOUD_URL, { op: "soc_me", token: me.token });
    if (r.pub && r.skw) {
      try {
        const priv = socTd.decode(await EPC.dec(kek, EPC.unb64(r.skw))), self = await socPair(priv, r.pub, "elitepro:yo");
        me.sk = priv; me.spub = r.pub; me.fk = EPC.b64(await EPC.dec(self, EPC.unb64(r.fks))); me.fh = ""; if (cs === me) { cStore(me); socPub(true).catch(() => {}); } return;
      } catch (e) { /* se restableció la contraseña sin la llave: las claves viejas no se pueden abrir y se crean otras */ }
    }
    await socNewKeys(kek, me);
  } catch (e) { if (e && e.code === "op") socOld = true; console.warn("Elitepro · amigos: " + (e && e.code || e)); }
}
async function socNewKeys(kek, me) {
  const k = await socGen(), fk = EPC.rand(32), self = await socPair(k.priv, k.pub, "elitepro:yo");
  await EPC.api(CLOUD_URL, { op: "soc_set", token: me.token, pub: k.pub, skw: EPC.b64(await EPC.enc(kek, socTe.encode(k.priv))), fks: EPC.b64(await EPC.enc(self, fk)), name: socName() });
  me.sk = k.priv; me.spub = k.pub; me.fk = EPC.b64(fk); me.fh = ""; if (cs === me) { cStore(me); socPub(true).catch(() => {}); }
}
/* Al cambiar la contraseña, la llave privada se vuelve a guardar protegida con la nueva */
async function socRewrap(kek) {
  const me = cs; if (!me || !me.sk) return;
  const self = await socPair(me.sk, me.spub, "elitepro:yo");
  await EPC.api(CLOUD_URL, { op: "soc_set", token: me.token, pub: me.spub, skw: EPC.b64(await EPC.enc(kek, socTe.encode(me.sk))), fks: EPC.b64(await EPC.enc(self, EPC.unb64(me.fk))), name: socName() });
}
/* Lo que ven los amigos: foto, nombre y, de las dos últimas semanas, entrenos y comidas. Ni peso, ni salud, ni cómo se encuentra */
function socFeed(days) {
  const p = S.profile, t0 = today(), out = [];
  for (let i = 0; i < (days || SOC_DAYS); i++) {
    const d = addDays(t0, -i), x = S.days[d]; if (!x || (!(x.acts || []).length && !(x.meals || []).length)) continue;
    out.push({ d, a: (x.acts || []).map(a => ({ t: a.type, m: Math.round(a.min || 0), km: a.km ? Math.round(a.km * 100) / 100 : 0, n: a.title || "", f: a.full === true ? 1 : a.full === false ? 0 : -1, r: a.res || "", w: a.with === "pareja" ? 1 : 0, mt: a.mate || "" })),
      m: (x.meals || []).map(m => ({ s: m.slot, n: m.name, g: m.g || 0, u: m.u || "", k: Math.round(m.kcal || 0), p: Math.round(m.p || 0), c: Math.round(m.c || 0), f: Math.round(m.f || 0) })) });
  }
  return { v: 1, name: socName(), photo: p.photo || "", days: out };
}
async function socPub(force) {
  const me = cs; if (!me || !me.token || !me.fk || !S.profile) return;
  let n = SOC_DAYS, obj = socFeed(n); const h = await EPC.sha(JSON.stringify(obj)); if (!force && h === me.fh) return;
  let blob = await EPC.seal(EPC.unb64(me.fk), Object.assign({ at: Date.now() }, obj));
  while (blob.length > 47000 && n > 1) { n = Math.max(1, n - 3); obj = socFeed(n); blob = await EPC.seal(EPC.unb64(me.fk), Object.assign({ at: Date.now() }, obj)); }
  if (blob.length > 47000) { obj.photo = ""; blob = await EPC.seal(EPC.unb64(me.fk), Object.assign({ at: Date.now() }, obj)); }
  await EPC.api(CLOUD_URL, { op: "feed_set", token: me.token, feed: blob, name: socName() });
  me.fh = h; if (cs === me) cStore(me);
}
/* Trae amigos y solicitudes; abre el perfil de cada amigo con la llave que me dio, y da la mía a quien aún no la tenga */
async function socLoad() {
  const me = cs; if (!me || !me.token || !me.sk || socBusy) return;
  socBusy = true; socErr = "";
  try {
    const r = await EPC.api(CLOUD_URL, { op: "fr_list", token: me.token }), wraps = {};
    const friends = await Promise.all((r.friends || []).map(async f => {
      let feed = null;
      if (!f.mine && f.pub) { try { wraps[f.id] = await socWrap(me, f.pub); } catch (e) { /* clave rara: se intenta la próxima vez */ } }
      if (f.wrap && f.feed && f.pub) { try { const fk = await EPC.dec(await socPair(me.sk, f.pub, "elitepro:amigos"), EPC.unb64(f.wrap)); feed = await EPC.open(fk, f.feed); } catch (e) { feed = null; } }
      return { id: f.id, name: f.name, pub: f.pub, feed, at: f.at, waiting: !f.wrap };
    }));
    if (Object.keys(wraps).length) await EPC.api(CLOUD_URL, { op: "fr_wrap", token: me.token, wraps });
    socData = { friends: friends.sort((a, b) => a.name.localeCompare(b.name, "es")), incoming: r.incoming || [], outgoing: r.outgoing || [], t: Date.now() };
  } catch (e) { socErr = e && e.code === "sesion" ? "Tu sesión ha caducado: vuelve a entrar en tu cuenta." : "No he podido traer a tus amigos. Comprueba la conexión."; }
  finally { socBusy = false; if (S.tab === "amigos") rAmigos(); else if (S.tab === "hoy" && S.profile) rGuideSoc(); }
}
/* Dejar a alguien: la llave de amigos cambia y se vuelve a dar solo a los que quedan */
async function socRotate() {
  const me = cs; if (!me || !me.sk) return;
  const fk = EPC.rand(32), self = await socPair(me.sk, me.spub, "elitepro:yo"); me.fk = EPC.b64(fk); me.fh = "";
  const wraps = {}; for (const f of (socData ? socData.friends : [])) if (f.pub) wraps[f.id] = await socWrap(me, f.pub);
  const obj = socFeed(); let feed = await EPC.seal(fk, Object.assign({ at: Date.now() }, obj)); if (feed.length > 47000) feed = await EPC.seal(fk, Object.assign({ at: Date.now() }, socFeed(4), { photo: "" }));
  await EPC.api(CLOUD_URL, { op: "fr_wrap", token: me.token, wraps, fks: EPC.b64(await EPC.enc(self, fk)), feed });
  me.fh = await EPC.sha(JSON.stringify(obj)); if (cs === me) cStore(me);
}

/* Si cambia la cuenta (entra, sale, activa Amigos), la sección se vuelve a pintar */
let socKey = "";
function socState() { const k = (cs && cs.token ? "1" : "0") + (cs && cs.sk ? "1" : "0") + (cs ? cs.uid : ""); if (k === socKey) return; socKey = k; socData = null; if (S.tab === "amigos" && S.profile) rAmigos(); }
/* --- pintado --- */
const socAv = (photo, name, size) => photo && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) ? `<img class="av" src="${photo}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">` : `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px" aria-hidden="true">${esc(((name || "?").trim()[0] || "?").toUpperCase())}</span>`;
const socAgo = d => { const n = daysTo(d, today()); return n <= 0 ? "hoy" : n === 1 ? "ayer" : "hace " + n + " días"; };
const socActTxt = a => [(TYPES[a.t] || {}).n || "Entreno", a.n ? "«" + a.n + "»" : "", a.m ? a.m + "′" : "", a.km ? nf(a.km, 1) + " km" : "", a.f === 1 ? "completo" : a.f === 0 ? "adaptado" : "", a.r ? "resultado " + a.r : "", a.w ? "en pareja" + (a.mt ? " con " + a.mt : "") : ""].filter(Boolean).join(" · ");
function socLast(feed) { if (!feed || !feed.days || !feed.days.length) return "Aún no ha compartido nada."; const a = feed.days.find(x => x.a.length); return a ? "Último entreno " + socAgo(a.d) + ": " + socActTxt(a.a[0]) : "Ha apuntado comidas " + socAgo(feed.days[0].d) + "."; }
rAmigos = function () {
  const box = $("#am-body"); if (!box) return;
  if (!cs || !cs.token) { box.innerHTML = `<div class="card col" style="gap:12px"><h2 class="ghi">Entrena con tus amigos</h2><p class="sub">Para tener amigos en Elitepro necesitas tu cuenta en la nube. Tus amigos ven tu foto, tu nombre, tus entrenos y tus comidas; nunca tu peso ni tus datos de salud.</p><div class="row"><button class="btn" type="button" data-cl="register">Crear cuenta</button><button class="btn ghost" type="button" data-cl="login">Ya tengo cuenta</button></div></div>`; return; }
  if (socOld) { box.innerHTML = `<div class="card"><p class="sub">Amigos estará disponible en cuanto se actualice el servidor de Elitepro. Vuelve a mirar en un rato.</p></div>`; return; }
  if (!cs.sk) { box.innerHTML = `<div class="card col" style="gap:12px"><h2 class="ghi">Activa Amigos</h2><p class="sub">Confirma tu contraseña una vez: con ella se crea la llave que protege lo que compartes, para que solo lo vean los amigos que aceptes. Ni el administrador puede leerlo.</p><label class="fld">Tu contraseña<input id="am-pass" type="password" autocomplete="current-password"></label><div class="row"><button class="btn" type="button" id="am-on">Activar</button></div><p id="am-msg" class="msg" aria-live="polite"></p></div>`; return; }
  const p = S.profile || {}, D = socData;
  const me = `<div class="card col" style="gap:12px"><div class="card-head"><span class="eyebrow">Tu perfil para amigos</span></div>
      <div class="amme">${socAv(p.photo, socName(), 72)}<div><b>${esc(socName())}</b><p class="sub">Tus amigos ven tu foto, tu nombre, tus entrenos y tus comidas de las dos últimas semanas. Nunca tu peso ni tus datos de salud.</p></div></div>
      <div class="row"><span class="btn ghost sm fileb">${p.photo ? "Cambiar foto" : "Poner foto"}<input id="am-photo" type="file" accept="image/*" aria-label="Foto de perfil"></span>${p.photo ? `<button class="btn ghost sm" type="button" id="am-nophoto">Quitar foto</button>` : ""}</div></div>`;
  const add = `<div class="card col" style="gap:10px"><div class="card-head"><span class="eyebrow">Añadir amigo</span></div><p class="sub">Escribe el correo con el que tiene cuenta en Elitepro. Le llega tu solicitud y, si la acepta, os veis los dos.</p>
      <form id="am-add" class="row" autocomplete="off"><label class="fld wide">Su correo<input id="am-mail" type="text" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="nombre@correo.com" required></label><button class="btn" type="submit">Enviar solicitud</button></form><p id="am-msg" class="msg" aria-live="polite"></p></div>`;
  if (!D) { box.innerHTML = me + add + `<div class="card"><p class="sub">${socErr ? esc(socErr) : "Cargando a tus amigos…"}</p></div>`; if (!socBusy && !socErr) socLoad(); return; }
  const inc = D.incoming.length ? `<div class="card col" style="gap:10px"><div class="card-head"><span class="eyebrow">Solicitudes para ti</span><span class="chip now">${D.incoming.length}</span></div><ul class="amlist">${D.incoming.map(r => `<li>${socAv("", r.name, 44)}<span><b>${esc(r.name)}</b><small>quiere ser tu amigo en Elitepro</small></span><span class="gbtn"><button class="btn sm" type="button" data-fr-ok="${esc(r.rid)}">Aceptar</button><button class="btn ghost sm" type="button" data-fr-no="${esc(r.rid)}">Rechazar</button></span></li>`).join("")}</ul></div>` : "";
  const fr = `<div class="card col" style="gap:10px"><div class="card-head"><span class="eyebrow">Tus amigos</span><button class="btn ghost sm" type="button" id="am-reload">Actualizar</button></div>${D.friends.length ? `<ul class="amlist">${D.friends.map(f => `<li><button class="amf" type="button" data-fr-see="${esc(f.id)}">${socAv(f.feed && f.feed.photo, f.name, 44)}<span><b>${esc(f.name)}</b><small>${f.feed ? esc(socLast(f.feed)) : f.waiting ? "Acabáis de ser amigos: verás su perfil en cuanto abra la app." : "Aún no ha compartido nada."}</small></span><span aria-hidden="true">›</span></button></li>`).join("")}</ul>` : `<p class="sub">Aún no tienes amigos aquí. Añade a tu pareja de entreno o a la gente de tu box con su correo.</p>`}
      ${D.outgoing.length ? `<p class="sub">Solicitudes enviadas, pendientes de aceptar:</p><ul class="amlist">${D.outgoing.map(o => `<li><span class="av" style="width:36px;height:36px;font-size:14px" aria-hidden="true">@</span><span><b>${esc(o.email)}</b><small>pendiente</small></span><span class="gbtn"><button class="btn ghost sm" type="button" data-fr-cancel="${esc(o.rid)}">Cancelar</button></span></li>`).join("")}</ul>` : ""}</div>`;
  box.innerHTML = inc + fr + add + me + (socErr ? `<p class="msg err">${esc(socErr)}</p>` : "");
};
/* El perfil de un amigo: sus entrenos y comidas de las dos últimas semanas */
function socFriendSheet(id) {
  const f = socData && socData.friends.find(x => x.id === id); if (!f) return;
  const F = f.feed, SL = k => ((SLOTS.find(x => x[0] === k) || [])[1] || "").toLowerCase();
  $("#sh-friend-t").textContent = f.name;
  $("#friend-body").innerHTML = `<div class="amme">${socAv(F && F.photo, f.name, 80)}<div><b>${esc(f.name)}</b><p class="sub">${F && F.at ? "Actualizado " + socAgo(new Date(F.at).toISOString().slice(0, 10)) : ""}</p></div></div>` +
    (!F ? `<p class="sub">${f.waiting ? "Acabáis de ser amigos: verás su perfil en cuanto abra la app." : "Aún no ha compartido nada."}</p>` : !F.days.length ? `<p class="sub">No ha apuntado nada en las dos últimas semanas.</p>` :
      F.days.map(x => { const kc = x.m.reduce((a, m) => a + m.k, 0), P = x.m.reduce((a, m) => a + m.p, 0), C = x.m.reduce((a, m) => a + m.c, 0), G = x.m.reduce((a, m) => a + m.f, 0);
        return `<div class="dslot"><div class="dslot-h"><b>${esc(cap(longDate(x.d)))}</b></div>${x.a.map(a => `<p>🏋️ ${esc(socActTxt(a))}</p>`).join("")}${x.m.length ? `<details class="how"><summary>${nf(kc)} kcal · P ${nf(P)} · H ${nf(C)} · G ${nf(G)} g · ${x.m.length} ${x.m.length === 1 ? "comida" : "comidas"}</summary><ul class="pnotes" style="padding-top:6px">${x.m.map(m => `<li>${esc(cap(SL(m.s)))}: ${esc(m.n)}${m.g ? " · " + esc(qtyTxt(m.g, m.u)) : ""} · ${nf(m.k)} kcal</li>`).join("")}</ul></details>` : ""}</div>`; }).join("")) +
    `<div class="row actions"><button class="btn ghost sm" type="button" data-fr-del="${esc(f.id)}">${socAsk === f.id ? "Pulsa otra vez para dejar de ser amigos" : "Dejar de ser amigos"}</button></div>`;
}
/* En Hoy, una línea en la guía si alguien te ha pedido amistad */
function rGuideSoc() {
  const g = $("#guide-card"), n = socData ? socData.incoming.length : 0; if (!g || g.hidden) return;
  const old = g.querySelector(".amnote"); if (old) old.remove();
  if (n) g.insertAdjacentHTML("beforeend", `<p class="ask amnote">${n === 1 ? esc(socData.incoming[0].name) + " quiere ser tu amigo en Elitepro." : n + " personas quieren ser tus amigas en Elitepro."} <a href="#amigos" style="color:var(--ink)">Ver</a></p>`);
}
document.addEventListener("click", async e => {
  const x = e.target.closest("#am-on,#am-reload,#am-nophoto,[data-fr-ok],[data-fr-no],[data-fr-cancel],[data-fr-see],[data-fr-del]"); if (!x || !cs || !cs.token) return;
  const msg = (t, err) => { const m = $("#am-msg"); if (m) { m.textContent = t; m.className = "msg" + (err ? " err" : ""); } else if (t) toast(t); }, ds = x.dataset;
  try {
    if (x.id === "am-on") {
      const pass = ($("#am-pass") || {}).value || ""; if (!pass) return msg("Escribe tu contraseña.", true);
      x.disabled = true; msg("Un momento…");
      const k = await EPC.derive(pass, "elitepro:user:" + cs.email), r = await EPC.api(CLOUD_URL, { op: "login", email: cs.email, auth: k.auth });
      await EPC.dec(k.kek, EPC.unb64(r.wrapUser)); cs.token = r.token; cStore();
      await socAfterAuth(k.kek); if (!cs.sk) return msg("No se ha podido activar. Inténtalo otra vez.", true);
      socData = null; socPub(true).catch(() => {}); rAmigos(); return toast("Amigos activado.");
    }
    if (x.id === "am-reload") { socData = null; rAmigos(); return; }
    if (x.id === "am-nophoto") { const p = clone(S.profile); delete p.photo; saveProfile(p); return; }
    if (ds.frOk) { const r = socData.incoming.find(q => q.rid === ds.frOk); x.disabled = true; await EPC.api(CLOUD_URL, { op: "fr_ans", token: cs.token, rid: ds.frOk, ok: true, wrap: await socWrap(cs, r.pub) }); toast("Ahora " + r.name + " y tú sois amigos."); socData = null; return rAmigos(); }
    if (ds.frNo) { x.disabled = true; await EPC.api(CLOUD_URL, { op: "fr_ans", token: cs.token, rid: ds.frNo, ok: false }); socData = null; return rAmigos(); }
    if (ds.frCancel) { x.disabled = true; await EPC.api(CLOUD_URL, { op: "fr_del", token: cs.token, rid: ds.frCancel }); socData = null; return rAmigos(); }
    if (ds.frSee) { socAsk = ""; socFriendSheet(ds.frSee); return openSheet("friend"); }
    if (ds.frDel) {
      if (socAsk !== ds.frDel) { socAsk = ds.frDel; return socFriendSheet(ds.frDel); }
      x.disabled = true; const f = socData.friends.find(q => q.id === ds.frDel);
      await EPC.api(CLOUD_URL, { op: "fr_del", token: cs.token, id: ds.frDel }); socData.friends = socData.friends.filter(q => q.id !== ds.frDel); socAsk = "";
      await socRotate(); closeSheets(); toast("Ya no sois amigos" + (f ? " con " + f.name : "") + ". Desde ahora no verá lo que apuntes."); socData = null; return rAmigos();
    }
  } catch (err) {
    x.disabled = false; if (err && err.code === "op") { socOld = true; return rAmigos(); }
    msg(err && err.name === "OperationError" ? "Contraseña incorrecta." : err && err.code === "credenciales" ? "Contraseña incorrecta." : err && err.code === "sesion" ? "Tu sesión ha caducado: vuelve a entrar en tu cuenta." : "No se ha podido hacer. Comprueba la conexión e inténtalo otra vez.", true);
  }
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "am-add") return; e.preventDefault();
  const m = $("#am-msg"), i = $("#am-mail"), email = i.value.trim().toLowerCase(), b = e.target.querySelector("button"), say = (t, err) => { m.textContent = t; m.className = "msg" + (err ? " err" : ""); };
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return say("Escribe un correo válido.", true);
  if (email === cs.email) return say("Ese es tu propio correo.", true);
  b.disabled = true; say("Enviando…");
  try { await EPC.api(CLOUD_URL, { op: "fr_req", token: cs.token, email }); i.value = ""; socData = null; rAmigos(); toast("Solicitud enviada. Si tiene cuenta con ese correo, le aparecerá para aceptarla."); }
  catch (err) { b.disabled = false; say(err && err.code === "demasiadas" ? "Tienes demasiadas solicitudes pendientes." : err && err.code === "sesion" ? "Tu sesión ha caducado: vuelve a entrar en tu cuenta." : "No se ha podido enviar. Inténtalo otra vez.", true); }
});
/* Foto de perfil: recorte cuadrado de 256 px en JPEG, para que pese poco */
document.addEventListener("change", async e => {
  if (e.target.id !== "am-photo" || !S.profile) return;
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const bmp = await createImageBitmap(f), side = Math.min(bmp.width, bmp.height), c = document.createElement("canvas"); c.width = c.height = 256;
    c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256); if (bmp.close) bmp.close();
    let q = 0.82, url = c.toDataURL("image/jpeg", q); while (url.length > 24000 && q > 0.4) { q -= 0.12; url = c.toDataURL("image/jpeg", q); }
    const p = clone(S.profile); p.photo = url; saveProfile(p); toast("Foto puesta. Tus amigos la verán.");
  } catch (err) { toast("No he podido usar esa imagen. Prueba con otra."); }
});
/* Al abrir la app con la cuenta y Amigos activados, se miran las solicitudes pendientes (para avisar en Hoy) */
setTimeout(() => { if (cs && cs.token && cs.sk) socLoad(); }, 3000);
