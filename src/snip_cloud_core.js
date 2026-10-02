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
  async function api(url, body) {
    let r; try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" }); } catch (e) { throw Object.assign(new Error("red"), { code: "red" }); }
    let j; try { j = await r.json(); } catch (e) { throw Object.assign(new Error("red"), { code: "red" }); }
    if (!j.ok) throw Object.assign(new Error(j.err), { code: j.err });
    return j;
  }
  async function sha(s) { return hex(new Uint8Array(await sub.digest("SHA-256", te.encode(s)))); }
  return { b64, unb64, hex, rand, derive, enc, dec, seal, open, wrapFor, api, sha, sub };
})();
