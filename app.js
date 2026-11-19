const PRAYERS = [
  { key: "fajr", name: "Fajr" },
  { key: "zuhr", name: "Zuhr" },
  { key: "asr", name: "Asr" },
  { key: "maghrib", name: "Maghrib" },
  { key: "isha", name: "Isha" },
];

// Current date/time at the masjid (works even if the phone is set elsewhere)
function masjidNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MASJID.timeZone, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(new Date());
  const p = {};
  parts.forEach((x) => (p[x.type] = Number(x.value)));
  return { y: p.year, m: p.month, d: p.day, secs: p.hour * 3600 + p.minute * 60 + p.second };
}

function addDays(y, m, d, n) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() };
}

function fmt(mins, withAmPm = true) {
  let h = Math.floor(mins / 60), m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${withAmPm ? " " + ap : ""}`;
}

// Today's list in time order; on Friday, Jumu'ah takes Zuhr's place.
// In Ramadan Taraweeh follows Isha, and on Eid the Eid prayer(s) are added.
function dayList(t) {
  const list = PRAYERS.map((p) =>
    p.key === "zuhr" && t.isFriday
      ? { key: "jumuah", name: "Jumu'ah", mins: t.jumuah }
      : { key: p.key, name: p.name, mins: t[p.key] }
  );
  if (t.taraweeh != null) list.push({ key: "taraweeh", name: "Taraweeh", mins: t.taraweeh });
  if (t.eid) t.eid.times.forEach((mins, i) => list.push({
    key: "eid", name: t.eid.times.length > 1 ? `${t.eid.name} (${i + 1})` : t.eid.name, mins, place: t.eid.place,
  }));
  return list.sort((a, b) => a.mins - b.mins);
}

function longDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function findNext(now) {
  const today = iqamahFor(now.y, now.m, now.d);
  const list = dayList(today);
  const nowMins = now.secs / 60;
  const idx = list.findIndex((p) => p.mins > nowMins);
  if (idx >= 0) return { idx, item: list[idx], secsLeft: list[idx].mins * 60 - now.secs };
  const tm = addDays(now.y, now.m, now.d, 1);
  const tFajr = iqamahFor(tm.y, tm.m, tm.d).fajr;
  return { idx: -1, item: { key: "fajr", name: "Fajr (tomorrow)", mins: tFajr }, secsLeft: 86400 - now.secs + tFajr * 60 };
}

// "Jumada al-Ula 12, 1448 AH" for a calendar date ("" if the browser lacks the Islamic calendar).
// Built from parts so the era shows as "AH" (Hijri), never "BC"/"BCE".
function hijriLabel(y, m, d) {
  try {
    const h = {};
    new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" })
      .formatToParts(new Date(Date.UTC(y, m - 1, d, 12))).forEach((x) => (h[x.type] = x.value));
    const MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
      "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul Qa'dah", "Dhul Hijjah"];
    return `${MONTHS[Number(h.month) - 1]} ${h.day}, ${h.year} AH`;
  } catch (e) { return ""; }
}

function renderStatic(now) {
  // Name on the first line; the street address (a Google Maps link) underneath when the masjid has one
  const addr = MASJID.address && MASJID.address !== MASJID.city ? MASJID.address : "";
  document.getElementById("masjid").textContent = addr ? `${MASJID.name}  ▾` : `${MASJID.name} · ${MASJID.city}  ▾`;
  const addrEl = document.getElementById("masjidAddr");
  addrEl.textContent = addr;
  addrEl.href = addr ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${MASJID.name}, ${addr}`) : "#";
  addrEl.style.display = addr ? "" : "none";
  document.getElementById("footNote").innerHTML = (MASJID.note || "").split("\n").map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br>");

  const greg = longDate(now.y, now.m, now.d);
  // In Ramadan the masjid's own day count (moon sighting differs between masjids) replaces the calendar's
  const rDay = ramadanDay(MASJID, now.y, now.m, now.d);
  const hijri = rDay ? `🌙 Ramadan, day ${rDay}` : hijriLabel(now.y, now.m, now.d);
  // Line 1: Hijri date. Line 2: regular date.
  document.getElementById("dates").innerHTML = hijri
    ? `<div class="hijri">${hijri}</div><div>${greg}</div>` : greg;

  // Eid coming up in the next 10 days: show its prayer times above today's list
  const eidCard = document.getElementById("eidCard");
  const up = upcomingEid(MASJID, now.y, now.m, now.d, 10);
  eidCard.hidden = !up;
  if (up) {
    eidCard.innerHTML = `<div class="eid-title">${escHtml(up.eid.name)} prayer</div>
      <div class="eid-when">${longDate(up.y, up.m, up.d)} · ${up.eid.times.map((x) => fmt(x)).join(" and ")}</div>
      ${up.eid.place ? `<div class="eid-place">${escHtml(up.eid.place)}</div>` : ""}`;
  }

  renderWeek(now);
}

// Week table: 7 days starting today + weekOffset weeks (swipe to change weeks)
let weekOffset = 0;
const MAX_WEEKS_AHEAD = 52;
function renderWeek(now) {
  const first = addDays(now.y, now.m, now.d, weekOffset * 7), last = addDays(now.y, now.m, now.d, weekOffset * 7 + 6);
  const short = (d, withMonth) => new Date(Date.UTC(d.y, d.m - 1, d.d)).toLocaleDateString("en-US",
    withMonth ? { month: "short", day: "numeric", timeZone: "UTC" } : { day: "numeric", timeZone: "UTC" });
  const range = `${short(first, true)} – ${short(last, last.m !== first.m)}`;
  document.getElementById("weekTitle").innerHTML =
    `<span>${weekOffset === 0 ? "This week" : "Week"} · ${range}</span><span class="dots" aria-hidden="true">${weekOffset > 0 ? "‹" : ""} ›</span>`;

  let html = "<tr><th>Day</th><th>Fajr</th><th>Zuhr</th><th>Asr</th><th>Magh</th><th>Isha</th></tr>";
  for (let j = 0; j < 7; j++) {
    const i = weekOffset * 7 + j;
    const d = addDays(now.y, now.m, now.d, i);
    const t = iqamahFor(d.y, d.m, d.d);
    const label = (i === 0 ? "Today" : new Date(Date.UTC(d.y, d.m - 1, d.d)).toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" }))
      + (t.ramadanDay ? " 🌙" : "") + (t.eid ? " ★" : "");
    const zuhr = t.isFriday ? `${fmt(t.jumuah, false)}<div style="font-size:10px;color:var(--gold)">Jumu'ah</div>` : fmt(t.zuhr, false);
    html += `<tr class="${i === 0 ? "today" : ""} ${t.isFriday ? "fri" : ""}">
      <td>${label}</td><td>${fmt(t.fajr, false)}</td><td>${zuhr}</td>
      <td>${fmt(t.asr, false)}</td><td>${fmt(t.maghrib, false)}</td><td>${fmt(t.isha, false)}</td></tr>`;
  }
  document.getElementById("week").innerHTML = html;
}

function changeWeek(step) {
  const next = Math.max(0, Math.min(MAX_WEEKS_AHEAD, weekOffset + step));
  if (next === weekOffset || !MASJID) return;
  const card = document.getElementById("weekCard");
  card.classList.add(step > 0 ? "slide-next" : "slide-prev");
  setTimeout(() => { weekOffset = next; renderWeek(masjidNow()); card.classList.remove("slide-next", "slide-prev"); }, 180);
}

// Swipe left = next week, swipe right = previous week (works with a finger or a mouse drag)
(function () {
  const card = document.getElementById("weekCard");
  let x0 = null, y0 = 0;
  card.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
  card.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) changeWeek(dx < 0 ? 1 : -1);
  });
  card.addEventListener("pointercancel", () => (x0 = null));
  // Tapping the title explains how to switch weeks
  let hintTimer = null;
  document.getElementById("weekTitle").addEventListener("click", () => {
    const hint = document.getElementById("weekHint");
    hint.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove("show"), 2500);
  });
})();

function renderToday(now, next) {
  const t = iqamahFor(now.y, now.m, now.d);
  const list = dayList(t);
  let html = list.map((p, i) => {
    const cls = i === next.idx ? "next" : (next.idx === -1 || i < next.idx) ? "past" : "";
    const sub = p.key === "jumuah" ? '<div class="sub">Friday prayer</div>'
      : p.key === "taraweeh" ? '<div class="sub">Ramadan night prayer</div>'
      : p.key === "eid" ? `<div class="sub">${p.place ? escHtml(p.place) : "Eid prayer"}</div>` : "";
    return `<div class="row ${cls}"><div><div class="name">${p.name}</div>${sub}</div><div class="time">${fmt(p.mins)}</div></div>`;
  }).join("");
  if (!t.isFriday) {
    html += `<div class="row"><div><div class="name">Jumu'ah</div><div class="sub">Every Friday</div></div><div class="time">${fmt(t.jumuah)}</div></div>`;
  }
  document.getElementById("today").innerHTML = html;
}

let lastDayKey = "", lastNextKey = "";
function tick() {
  if (!MASJID) return; // no masjid chosen yet (the picker is showing)
  const now = masjidNow();
  const next = findNext(now);
  const dayKey = `${now.y}-${now.m}-${now.d}`;
  if (dayKey !== lastDayKey) { renderStatic(now); lastDayKey = dayKey; lastNextKey = ""; }
  if (next.item.name !== lastNextKey) { renderToday(now, next); lastNextKey = next.item.name; }

  document.getElementById("nextName").textContent = next.item.name;
  document.getElementById("nextTime").textContent = fmt(next.item.mins);
  const s = Math.max(0, next.secsLeft);
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  document.getElementById("countdown").textContent =
    `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  if (window.onTick) window.onTick(now, next);
}

tick();
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { lastDayKey = ""; tick(); } });

// ---------- Install help ----------
const box = document.getElementById("install");
const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
let deferredPrompt = null;

if (!standalone && isIOS) {
  box.innerHTML = "<b>Add to your Home Screen</b><br>Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.";
  box.classList.add("show");
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  box.innerHTML = "<b>Install this app</b><br>Get iqamah times right from your home screen, even offline.<button id='installBtn'>Install</button>";
  box.classList.add("show");
  document.getElementById("installBtn").onclick = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    box.classList.remove("show");
  };
});

// ---------- Offline support ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
