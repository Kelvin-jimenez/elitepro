/* ---------- Nube: cifrado en el dispositivo y llamadas al servidor (lo comparten la app y el panel) ---------- */
const EPC = (() => {
  const te = new TextEncoder(), td = new TextDecoder(), sub = crypto.subtle;
  const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, "0")).join("");
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  /* De la contraseña salen dos cosas distintas: una prueba para entrar (va al servidor) y una llave que nunca sale del dispositivo */
  async function derive(pass, salt) {
    const k = await sub.importKey("raw", te.encode(pass.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await sub.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: te.encode(salt), iterations: 310000 }, k, 512));
    return { auth: hex(bits.subarray(0, 32)), kek: await sub.importKey("raw", bits.subarray(32), "AES-GCM", false, ["encrypt", "decrypt"]) };
  }
  const aes = raw => sub.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  async function enc(key, u8) { const iv = rand(12), ct = new Uint8Array(await sub.encrypt({ name: "AES-GCM", iv }, key, u8)), out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; }
  async function dec(key, u8) { return new Uint8Array(await sub.decrypt({ name: "AES-GCM", iv: u8.subarray(0, 12) }, key, u8.subarray(12))); }
  async function gz(u8, pack) { const s = pack ? new CompressionStream("gzip") : new DecompressionStream("gzip"); return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(s)).arrayBuffer()); }
  /* Datos → comprimidos y cifrados con la llave del usuario */
  async function seal(dek, obj) {
    let data = te.encode(JSON.stringify(obj)), flag = 0;
    if (typeof CompressionStream !== "undefined") { data = await gz(data, true); flag = 1; }
    const ct = await enc(await aes(dek), data), out = new Uint8Array(1 + ct.length); out[0] = flag; out.set(ct, 1); return b64(out);
  }
  async function open(dek, blob) {
    if (!blob) return null;
    const u = unb64(blob); let data = await dec(await aes(dek), u.subarray(1));
    if (u[0] === 1) data = await gz(data, false);
    return JSON.parse(td.decode(data));
  }
  /* Copia de la llave del usuario que solo el entrenador puede abrir */
  async function wrapFor(pubJwk, dek) { const k = await sub.importKey("jwk", JSON.parse(pubJwk), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]); return b64(new Uint8Array(await sub.encrypt({ name: "RSA-OAEP" }, k, dek))); }
  /* Una llamada al servidor, con tope de tiempo. Códigos de fallo propios: red (no se pudo conectar), lento (no contestó a tiempo),
     raro (contestó algo que no es lo esperado). Los demás códigos son los que devuelve el servidor. */
  const fail = code => Object.assign(new Error(code), { code });
  async function once(url, body, ms) {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms); let r, j;
    try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow", signal: ac.signal }); }
    catch (e) { clearTimeout(tm); throw fail(e && e.name === "AbortError" ? "lento" : "red"); }
    try { j = await r.json(); } catch (e) { clearTimeout(tm); throw fail(e && e.name === "AbortError" ? "lento" : "raro"); }
    clearTimeout(tm);
    if (!j.ok) throw fail(j.err || "error");
    return j;
  }
  /* Reintenta sola lo que se puede repetir sin riesgo: «ocupado» siempre (el servidor no llegó a hacer nada) y, si falla la red
     o tarda, las operaciones que dan lo mismo hechas una vez que dos. */
  const SAFE = ["pub", "load", "login", "save", "register", "a_hello", "a_list", "a_get"];
  async function api(url, body, ms) {
    const waits = [1500, 4000];
    for (let i = 0; ; i++) {
      try { return await once(url, body, ms || 40000); }
      catch (e) {
        const again = e.code === "ocupado" || ((e.code === "red" || e.code === "lento") && SAFE.includes(body.op));
        if (!again || i >= waits.length) throw e;
        await new Promise(r => setTimeout(r, waits[i]));
      }
    }
  }
  async function sha(s) { return hex(new Uint8Array(await sub.digest("SHA-256", te.encode(s)))); }
  return { b64, unb64, hex, rand, derive, enc, dec, seal, open, wrapFor, api, sha, sub };
})();
