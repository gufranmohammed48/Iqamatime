/* ============================================================
   IQAMAH SCHEDULE ENGINE
   Every masjid is a JSON file in masjids/ (see masjids/README.md).
   This file turns a masjid's rules into iqamah times for a date.

   A masjid's "schedule" has one entry per prayer: fajr, zuhr, asr,
   maghrib, isha. Each entry is one of:
     "6:35 AM"                            fixed time all year
     { "after": "sunset", "minutes": 5 }  minutes after sunset (the adhan)
     { "after": "adhan", "minutes": 15, "round": 5 }
                                          minutes after that prayer's calculated adhan,
                                          rounded up to the next 5 minutes ("round" is optional)
     [ rule, rule, ... ]                  different times on different dates

   "after adhan" uses the masjid's "calc" settings (default: ISNA 15 degrees, standard Asr):
     "calc": { "fajrAngle": 15, "ishaAngle": 15, "asr": "hanafi" }

   A rule is a fixed time or an "after" offset, plus an optional
   date range (the first rule that matches the date wins):
     from / to   "MM-DD" or "MM-sunN" (Nth Sunday of the month), inclusive
     since       same format, inclusive lower limit  (daylight saving switch)
     until       same format, EXCLUSIVE upper limit  (daylight saving switch)
   ============================================================ */

let MASJID = null; // the selected masjid's data (set by picker.js)

const PRAYER_KEYS = ["fajr", "zuhr", "asr", "maghrib", "isha"];

// Day of month of the nth Sunday (month is 0-based)
function nthSunday(year, month, n) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + 7 * (n - 1);
}

// "6:35 AM" / "1:30 PM" / "13:30" -> minutes after midnight
function parseTime(str) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(str);
  if (!m) throw new Error(`Bad time "${str}"`);
  let h = Number(m[1]);
  const min = Number(m[2]), ap = m[3] && m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

// "03-08" or "03-sun2" -> month*100+day for a given year
function pointKey(token, year) {
  const a = /^(\d{2})-(\d{2})$/.exec(token);
  if (a) return Number(a[1]) * 100 + Number(a[2]);
  const b = /^(\d{2})-sun(\d)$/.exec(token);
  if (b) return Number(b[1]) * 100 + nthSunday(year, Number(b[1]) - 1, Number(b[2]));
  throw new Error(`Bad date "${token}"`);
}

function ruleMatches(r, year, key) {
  if (r.from && key < pointKey(r.from, year)) return false;
  if (r.to && key > pointKey(r.to, year)) return false;
  if (r.since && key < pointKey(r.since, year)) return false;
  if (r.until && key >= pointKey(r.until, year)) return false;
  return true;
}

/* ---- sunset (NOAA / "sunrise equation"), returned as minutes after local midnight at the masjid ---- */
function sunsetMinutes(masjid, year, month1, day) {
  const rad = Math.PI / 180, lat = masjid.lat, lon = masjid.lon;
  const jdLocalNoon = Date.UTC(year, month1 - 1, day, 12) / 86400000 + 2440587.5 - lon / 360;
  const n = Math.round(jdLocalNoon - 2451545.0);
  const js = n + 0.0009 - lon / 360;            // lon: east positive, west negative
  const M = (357.5291 + 0.98560028 * js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDelta = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDelta = Math.cos(Math.asin(sinDelta));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDelta) / (Math.cos(lat * rad) * cosDelta);
  if (cosW < -1 || cosW > 1) throw new Error("No sunset on this date at this latitude");
  const jSet = jTransit + Math.acos(cosW) / (2 * Math.PI);
  const utcMs = (jSet - 2440587.5) * 86400000;
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: masjid.timeZone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
    .formatToParts(new Date(utcMs)).forEach((x) => (p[x.type] = Number(x.value)));
  return Math.round(p.hour * 60 + p.minute + p.second / 60);
}

/* ---- adhan (prayer start) times, the standard "praytimes" method ----
   Returned as minutes after local midnight at the masjid, for the "after adhan" rule. */
function adhanTimes(masjid, year, month1, day) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const calc = masjid.calc || {};
  const lat = masjid.lat, lon = masjid.lon;
  const fajrAngle = calc.fajrAngle || 15, ishaAngle = calc.ishaAngle || 15;
  const asrFactor = calc.asr === "hanafi" ? 2 : 1;
  const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
  const jDate = Date.UTC(year, month1 - 1, day) / 86400000 + 2440587.5 - lon / (15 * 24);
  function sun(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = Math.atan2(Math.cos(e * rad) * Math.sin(L * rad), Math.cos(L * rad)) * deg / 15;
    return { decl: Math.asin(Math.sin(e * rad) * Math.sin(L * rad)) * deg, eqt: q / 15 - fix(RA, 24) };
  }
  const midDay = (t) => fix(12 - sun(jDate + t).eqt, 24);
  function angleTime(angle, t, before) {
    const decl = sun(jDate + t).decl, noon = midDay(t);
    const c = (-Math.sin(angle * rad) - Math.sin(decl * rad) * Math.sin(lat * rad)) / (Math.cos(decl * rad) * Math.cos(lat * rad));
    const T = Math.acos(Math.max(-1, Math.min(1, c))) * deg / 15;
    return noon + (before ? -T : T);
  }
  function asrTime(t) {
    const decl = sun(jDate + t).decl;
    const angle = -Math.atan(1 / (asrFactor + Math.tan(Math.abs(lat - decl) * rad))) * deg;
    return angleTime(angle, t);
  }
  // two passes: the first guesses each time of day, the second refines with it
  let h = { fajr: 5, sunrise: 6, zuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let pass = 0; pass < 2; pass++) {
    const t = {}; for (const k in h) t[k] = h[k] / 24;
    h = {
      fajr: angleTime(fajrAngle, t.fajr, true), sunrise: angleTime(0.833, t.sunrise, true),
      zuhr: midDay(t.zuhr), asr: asrTime(t.asr), maghrib: angleTime(0.833, t.maghrib), isha: angleTime(ishaAngle, t.isha),
    };
  }
  const out = {};
  for (const k in h) { // solar hours (UTC at the masjid's longitude) -> wall clock at the masjid
    const utcMs = Date.UTC(year, month1 - 1, day) + (h[k] - lon / 15) * 3600000;
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: masjid.timeZone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
      .formatToParts(new Date(utcMs)).forEach((x) => (p[x.type] = Number(x.value)));
    out[k] = Math.round(p.hour * 60 + p.minute + p.second / 60);
  }
  return out;
}

function resolveEntry(entry, masjid, year, month1, day, prayer) {
  if (typeof entry === "string") return parseTime(entry);
  if (entry.at) return parseTime(entry.at);
  let mins;
  if (entry.after === "sunset") mins = sunsetMinutes(masjid, year, month1, day) + (entry.minutes || 0);
  else if (entry.after === "adhan") mins = adhanTimes(masjid, year, month1, day)[prayer] + (entry.minutes || 0);
  else throw new Error("Rule needs 'at' or 'after'");
  return entry.round ? Math.ceil(mins / entry.round) * entry.round : mins;
}

function minutesFor(masjid, prayer, year, month1, day) {
  const entry = masjid.schedule[prayer];
  if (!Array.isArray(entry)) return resolveEntry(entry, masjid, year, month1, day, prayer);
  const key = month1 * 100 + day;
  const rule = entry.find((r) => ruleMatches(r, year, key));
  if (!rule) throw new Error(`${masjid.name}: no ${prayer} rule covers ${month1}/${day}`);
  return resolveEntry(rule, masjid, year, month1, day, prayer);
}

/* ---- Schedule changes, Ramadan and Eid ----
   Entered by each masjid's admin on the admin page (admin/) and attached by picker.js
   as masjid.season:
     { changes: [ { from: "2026-11-23", to: "2026-11-29",                     to is optional:
                    times: { fajr, zuhr, asr, maghrib, isha, jumuah } } ],     "until the next change"
       ramadan: { start: "2027-02-08", days: 30,
                  times:  { fajr, zuhr, asr, maghrib, isha, taraweeh },      for every night
                  byDate: { "2027-02-20": { isha: "8:45 PM" } } },           one-day changes
       eids: [ { name: "Eid al-Fitr", date: "2027-03-10", times: ["8:00 AM", "9:30 AM"], place: "..." } ] }
   A time is "6:30 AM" or "sunset+10". A blank or missing time keeps the normal schedule.
   When several changes cover a date, each prayer comes from the latest-starting change that sets it;
   Ramadan times win over changes. */
function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function seasonTime(v, masjid, y, m, d) {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = /^\s*sunset\s*\+\s*(\d{1,3})\s*$/i.exec(v);
  const mins = s ? sunsetMinutes(masjid, y, m, d) + Number(s[1]) : parseTime(v);
  if (!(mins >= 0 && mins < 1440)) throw new Error(`Bad time "${v}"`);
  return mins;
}

// Day of Ramadan (1-30) at this masjid, or 0 when the date isn't in its Ramadan
function ramadanDay(masjid, y, m, d) {
  const r = masjid.season && masjid.season.ramadan;
  const s = r && /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.start || "");
  if (!s) return 0;
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(Number(s[1]), Number(s[2]) - 1, Number(s[3]))) / 86400000) + 1;
  return n >= 1 && n <= (r.days === 29 ? 29 : 30) ? n : 0;
}

// Times from the schedule changes covering an ISO date. For each prayer, the latest-starting
// change that sets it wins, so a short change for one prayer leaves the others as they were.
function changeTimes(season, key) {
  const out = {}, from = {};
  for (const c of Array.isArray(season.changes) ? season.changes : []) {
    if (!c || typeof c.from !== "string" || c.from > key || (c.to && c.to < key) || !c.times) continue;
    for (const k in c.times) {
      if (typeof c.times[k] === "string" && c.times[k].trim() && !(from[k] > c.from)) { out[k] = c.times[k]; from[k] = c.from; }
    }
  }
  return out;
}

function seasonFor(masjid, y, m, d) {
  const season = masjid.season, out = {};
  if (!season) return out;
  const key = isoDate(y, m, d), n = ramadanDay(masjid, y, m, d);
  const changed = changeTimes(season, key);
  for (const k of [...PRAYER_KEYS, "jumuah"]) {
    const v = seasonTime(changed[k], masjid, y, m, d);
    if (v !== null) out[k] = v;
  }
  if (n) {
    const r = season.ramadan, oneDay = (r.byDate && r.byDate[key]) || {}, every = r.times || {};
    for (const k of [...PRAYER_KEYS, "taraweeh"]) {
      let v = seasonTime(oneDay[k], masjid, y, m, d);
      if (v === null) v = seasonTime(every[k], masjid, y, m, d);
      if (v !== null) out[k] = v;
    }
    out.ramadanDay = n;
  }
  const eid = Array.isArray(season.eids) && season.eids.find((e) => e && e.date === key);
  if (eid) {
    const times = (eid.times || []).map((t) => seasonTime(t, masjid, y, m, d)).filter((v) => v !== null);
    if (times.length) out.eid = { name: String(eid.name || "Eid"), place: String(eid.place || ""), times: times.sort((a, b) => a - b) };
  }
  return out;
}

// Iqamah times (minutes after midnight) for one masjid on a calendar date (month is 1-based)
function iqamahForMasjid(masjid, year, month1, day) {
  const dow = new Date(Date.UTC(year, month1 - 1, day)).getUTCDay();
  const out = {};
  for (const k of PRAYER_KEYS) out[k] = minutesFor(masjid, k, year, month1, day);
  out.jumuah = parseTime(masjid.jumuah);
  out.isFriday = dow === 5;
  // Ramadan / Eid changes; a mistyped admin entry never breaks the normal times
  try { Object.assign(out, seasonFor(masjid, year, month1, day)); } catch (e) {}
  return out;
}

// The next Eid prayer within `days` days after the given date (not counting that date), or null
function upcomingEid(masjid, y, m, d, days) {
  for (let i = 1; i <= days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const t = iqamahForMasjid(masjid, dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    if (t.eid) return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), eid: t.eid };
  }
  return null;
}

// Same, for the masjid the user picked
function iqamahFor(year, month1, day) {
  return iqamahForMasjid(MASJID, year, month1, day);
}

if (typeof module !== "undefined") module.exports = { adhanTimes, iqamahForMasjid, sunsetMinutes, parseTime, nthSunday, ramadanDay, upcomingEid };
