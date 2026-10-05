/* ---------- Recordatorios: archivo .ics para calendarios que no son de Google (solo versión web) ---------- */
$("#rem-extra").innerHTML = `<div class="row" id="rem-ics-row" hidden><button class="btn ghost sm" type="button" id="rem-ics">Descargar todos para otro calendario (.ics)</button></div>`;
const remIcs = render; render = function () { remIcs(); const r = $("#rem-ics-row"); if (r) r.hidden = !(S.profile && rems().length); };
$("#rem-ics").addEventListener("click", () => {
  const z = s => String(s).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, " "), now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), day = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
  const ev = rems().map(r => ["BEGIN:VEVENT", "UID:" + r.id + "@elitepro", "DTSTAMP:" + stamp, "DTSTART:" + day + "T" + r.time.replace(":", "") + "00", "DURATION:PT10M",
    "RRULE:FREQ=" + (r.days === "lv" ? "WEEKLY;BYDAY=MO,TU,WE,TH,FR" : "DAILY"), "SUMMARY:" + z(r.title), "DESCRIPTION:Recordatorio de Elitepro",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + z(r.title), "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n"));
  const blob = new Blob([["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elitepro//Recordatorios//ES", "CALSCALE:GREGORIAN"].concat(ev, ["END:VCALENDAR"]).join("\r\n") + "\r\n"], { type: "text/calendar" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "elitepro-recordatorios.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
