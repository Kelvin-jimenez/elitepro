/* ---------- Copia de seguridad (solo sin sesión) ---------- */
$("#bk-out").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ app: "platoypista", profile: S.profile, days: S.days }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "elitepro-" + today() + ".json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$("#bk-in").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const raw = JSON.parse(String(rd.result)), p = normProfile(raw.profile);
      if (raw.app !== "platoypista" || !p) throw new Error("formato");
      const days = {}; Object.keys(raw.days || {}).forEach(k => { days[k] = normDay(raw.days[k], k); });
      S.profile = p; S.days = days; profDirty = false; saveLocal(); render(); toast("Copia recuperada.");
    } catch (err) { toast("Ese archivo no es una copia de Elitepro."); }
  };
  rd.readAsText(f);
});

