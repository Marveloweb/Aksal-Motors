// Aksal Motors booking API (Cloudflare Worker + D1).
//
//   GET  /api/availability   -> next working days with each slot marked free or booked
//   POST /api/bookings       -> books one slot; a second booking for the same slot is refused
//
// All slot times are New Zealand time (Pacific/Auckland), daylight saving included.
// After a booking is saved, the Google script at NOTIFY_URL sends the emails
// and adds the booking to the calendar. A failed email never cancels a booking.

const TZ = 'Pacific/Auckland';

export const SETTINGS = {
  days: [1, 2, 3, 4, 5],                 // Monday to Friday
  slotTimes: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'],
  slotMinutes: 60,
  daysAhead: 21,                          // how far ahead people can book
  minNoticeMinutes: 120,                  // no bookings less than 2 hours away
  services: [
    'Warrant of Fitness (WoF)',
    'Standard service',
    'Intermediate service',
    'Comprehensive service',
    'Repair or diagnosis',
    'Tyres or battery',
    'Pre-purchase inspection',
    'Something else',
  ],
};

// ---------- time helpers ----------
function partsInTz(ts) {
  const f = new Intl.DateTimeFormat('en-NZ', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, wd: p.weekday };
}
function tzOffsetMs(ts) {
  const p = partsInTz(ts);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000;
}
// NZ wall-clock date + time -> UTC timestamp (handles daylight saving)
export function nzToUtc(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let utc = wall - tzOffsetMs(wall);
  utc = wall - tzOffsetMs(utc);
  return utc;
}
const pad = n => String(n).padStart(2, '0');
function nzDateStr(ts) { const p = partsInTz(ts); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; }
function weekdayOf(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function label12(timeStr) {
  const [h, mi] = timeStr.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(mi)} ${h < 12 ? 'am' : 'pm'}`;
}
function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m - 1, d))).replace(',', '');
}

// ---------- availability ----------
export function candidateDays(now, s = SETTINGS) {
  const today = nzDateStr(now);
  const out = [];
  for (let i = 0; i <= s.daysAhead; i++) {
    const ds = addDays(today, i);
    if (s.days.includes(weekdayOf(ds))) out.push(ds);
  }
  return out;
}
function slotIsOpen(dateStr, timeStr, now, s = SETTINGS) {
  return nzToUtc(dateStr, timeStr) - now >= s.minNoticeMinutes * 60000;
}

async function availability(env, now) {
  const days = candidateDays(now);
  const { results } = await env.DB.prepare(
    "SELECT slot_date, slot_time FROM bookings WHERE status = 'confirmed' AND slot_date >= ?1 AND slot_date <= ?2"
  ).bind(days[0], days[days.length - 1]).all();
  const taken = new Set(results.map(r => `${r.slot_date} ${r.slot_time}`));
  const out = days.map(date => {
    const slots = SETTINGS.slotTimes.map(time => {
      const booked = taken.has(`${date} ${time}`);
      const open = slotIsOpen(date, time, now);
      return { time, label: label12(time), status: booked ? 'booked' : open ? 'free' : 'closed' };
    });
    return { date, label: dayLabel(date), free: slots.filter(x => x.status === 'free').length, slots };
  }).filter(d => d.slots.some(x => x.status !== 'closed'));
  return { timezone: TZ, services: SETTINGS.services, days: out };
}

// ---------- booking ----------
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(body, now) {
  const b = {
    date: clean(body.date, 10), time: clean(body.time, 5), service: clean(body.service, 60),
    name: clean(body.name, 80), phone: clean(body.phone, 30), email: clean(body.email, 120).toLowerCase(),
    rego: clean(body.rego, 10).toUpperCase(), notes: clean(body.notes, 500),
  };
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !candidateDays(now).includes(b.date)) errors.date = 'Choose one of the days shown.';
  if (!SETTINGS.slotTimes.includes(b.time)) errors.time = 'Choose one of the times shown.';
  else if (!errors.date && !slotIsOpen(b.date, b.time, now)) errors.time = 'That time is too soon. Please choose a later one.';
  if (!SETTINGS.services.includes(b.service)) errors.service = 'Choose a service.';
  if (b.name.length < 2) errors.name = 'Enter your name.';
  if (b.phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a phone number we can call.';
  if (!EMAIL_RE.test(b.email)) errors.email = 'Enter a valid email address for your confirmation.';
  return { b, errors };
}

async function createBooking(request, env, ctx, now) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Send the booking as JSON.' }, 400); }
  if (body.website) return json({ ok: true }, 200);   // honeypot: bots fill hidden fields; silently ignore

  const { b, errors } = validate(body, now);
  if (Object.keys(errors).length) return json({ error: 'Please check the highlighted fields.', fields: errors }, 422);

  const startsAt = new Date(nzToUtc(b.date, b.time)).toISOString();
  let id;
  try {
    const r = await env.DB.prepare(
      `INSERT INTO bookings (slot_date, slot_time, starts_at, service, name, phone, email, rego, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    ).bind(b.date, b.time, startsAt, b.service, b.name, b.phone, b.email, b.rego || null, b.notes || null).run();
    id = r.meta?.last_row_id;
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return json({ error: 'Sorry, someone has just booked that time. Please choose another.', code: 'taken' }, 409);
    }
    throw e;
  }

  const booking = { id, ...b, startsAt, endsAt: new Date(Date.parse(startsAt) + SETTINGS.slotMinutes * 60000).toISOString(), whenLabel: `${dayLabel(b.date)}, ${label12(b.time)}` };
  if (env.NOTIFY_URL && env.NOTIFY_SECRET) ctx.waitUntil(notify(env, booking));
  return json({ ok: true, booking: { id, date: b.date, time: b.time, whenLabel: booking.whenLabel, service: b.service } }, 201);
}

async function notify(env, booking) {
  let status = 'sent';
  try {
    const r = await fetch(env.NOTIFY_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.NOTIFY_SECRET, booking }),
    });
    if (!r.ok) status = `failed ${r.status}`;
  } catch (e) { status = 'failed ' + String(e).slice(0, 80); }
  await env.DB.prepare('UPDATE bookings SET notified = ?1 WHERE id = ?2').bind(status, booking.id).run();
}

// ---------- http ----------
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}
function cors(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(origin)
    ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'vary': 'origin' }
    : {};
}

export default {
  async fetch(request, env, ctx, nowOverride) {
    const now = nowOverride ?? Date.now();
    const url = new URL(request.url);
    const ch = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
    let res;
    try {
      if (url.pathname === '/api/availability' && request.method === 'GET') res = json(await availability(env, now), 200, { 'cache-control': 'no-store' });
      else if (url.pathname === '/api/bookings' && request.method === 'POST') res = await createBooking(request, env, ctx, now);
      else res = json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error(e);
      res = json({ error: 'Something went wrong on our side. Please call (04) 389 6250.' }, 500);
    }
    for (const [k, v] of Object.entries(ch)) res.headers.set(k, v);
    return res;
  },
};
