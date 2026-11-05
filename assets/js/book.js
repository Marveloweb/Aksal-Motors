// Aksal Motors online booking.
// Talks to the booking worker. If the worker can't be reached (for example
// before it is switched on), the page runs in a clearly labelled preview mode
// that shows how booking works without saving anything.
(function () {
  var API = 'https://aksal-booking.twilight-frog-a541.workers.dev';
  var TIMES = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  var SERVICES = ['Warrant of Fitness (WoF)', 'Standard service', 'Intermediate service', 'Comprehensive service', 'Repair or diagnosis', 'Tyres or battery', 'Pre-purchase inspection', 'Something else'];

  var form = document.getElementById('book-form');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var state = { days: [], service: null, date: null, time: null, demo: false, busy: false };

  // ---------- render ----------
  function chip(label, value, group, selected, disabled, extra) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (extra ? ' ' + extra : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', selected ? 'true' : 'false');
    b.dataset.value = value;
    b.dataset.group = group;
    if (disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    b.innerHTML = label;
    return b;
  }

  function renderServices(list) {
    var box = $('service-list'); box.innerHTML = '';
    list.forEach(function (s) { box.appendChild(chip(esc(s), s, 'service', s === state.service)); });
  }

  function renderDays() {
    var box = $('day-list'); box.innerHTML = '';
    state.days.forEach(function (d) {
      var parts = d.label.split(' ');           // e.g. "Fri 6 Nov"
      var html = '<span class="d-wd">' + esc(parts[0]) + '</span><span class="d-day">' + esc(parts[1] || '') + '</span><span class="d-mon">' + esc(parts[2] || '') + '</span>' +
        '<span class="d-free">' + (d.free ? d.free + ' free' : 'Full') + '</span>';
      box.appendChild(chip(html, d.date, 'date', d.date === state.date, d.free === 0, 'day'));
    });
  }

  function renderTimes() {
    var box = $('time-list'); box.innerHTML = '';
    var day = state.days.filter(function (d) { return d.date === state.date; })[0];
    $('time-hint').hidden = !!day;
    if (!day) return;
    day.slots.forEach(function (s) {
      var label = s.status === 'booked' ? esc(s.label) + '<small>Booked</small>' : s.status === 'closed' ? esc(s.label) + '<small>Too soon</small>' : esc(s.label);
      box.appendChild(chip(label, s.time, 'time', s.time === state.time, s.status !== 'free', 'time ' + s.status));
    });
  }

  function updateButton() {
    var day = state.days.filter(function (d) { return d.date === state.date; })[0];
    var slot = day && day.slots.filter(function (s) { return s.time === state.time; })[0];
    $('book-btn-label').textContent = slot ? 'Confirm booking for ' + day.label + ', ' + slot.label : 'Confirm booking';
  }

  function notice(text, kind) {
    var n = $('book-notice');
    n.hidden = !text; n.textContent = text || ''; n.className = 'book-notice' + (kind ? ' ' + kind : '');
  }

  function showErrors(fields) {
    ['service', 'date', 'time', 'name', 'phone', 'email'].forEach(function (k) {
      var el = $('err-' + k); if (!el) return;
      el.hidden = !(fields && fields[k]); el.textContent = (fields && fields[k]) || '';
      var input = $('f-' + k); if (input) input.setAttribute('aria-invalid', fields && fields[k] ? 'true' : 'false');
    });
    var first = fields && Object.keys(fields)[0];
    if (first) { var target = $('f-' + first) || $('err-' + first); if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  // ---------- data ----------
  function load(keepSelection) {
    return fetch(API + '/api/availability', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { state.demo = false; return data; })
      .catch(function () { state.demo = true; return demoData(); })
      .then(function (data) {
        state.days = data.days || [];
        if (!state.service) renderServices(data.services || SERVICES);
        if (!keepSelection || !state.days.some(function (d) { return d.date === state.date; })) {
          var first = state.days.filter(function (d) { return d.free > 0; })[0];
          state.date = first ? first.date : null; state.time = null;
        }
        renderDays(); renderTimes(); updateButton();
        if (state.demo) notice('Preview mode: this shows how online booking will work. Bookings made here are not saved yet. To book now, please call (04) 389 6250.', 'demo');
      });
  }

  // Preview data: same rules as the real system, in New Zealand time.
  function demoData() {
    var fmt = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var p = {}; fmt.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    var base = Date.UTC(+p.year, +p.month - 1, +p.day);
    var nowMin = (+p.hour) * 60 + (+p.minute);
    var days = [];
    for (var i = 0; i <= 21; i++) {
      var dt = new Date(base + i * 86400000), wd = dt.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      var iso = dt.toISOString().slice(0, 10);
      var label = new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(dt).replace(',', '');
      var slots = TIMES.map(function (t, k) {
        var mins = +t.slice(0, 2) * 60;
        var closed = i === 0 && mins - nowMin < 120;
        var booked = !closed && ((i * 3 + k) % 5 === 1);          // a few sample bookings
        var h = +t.slice(0, 2);
        return { time: t, label: ((h + 11) % 12 + 1) + ':00 ' + (h < 12 ? 'am' : 'pm'), status: closed ? 'closed' : booked ? 'booked' : 'free' };
      });
      if (slots.every(function (s) { return s.status === 'closed'; })) continue;
      days.push({ date: iso, label: label, free: slots.filter(function (s) { return s.status === 'free'; }).length, slots: slots });
    }
    return { services: SERVICES, days: days };
  }

  // ---------- events ----------
  form.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b || b.disabled) return;
    var g = b.dataset.group;
    if (g === 'service') { state.service = b.dataset.value; renderServices(SERVICES_FROM_DOM()); }
    if (g === 'date') { state.date = b.dataset.value; state.time = null; renderDays(); renderTimes(); }
    if (g === 'time') { state.time = b.dataset.value; renderTimes(); }
    updateButton();
    var err = $('err-' + g); if (err) err.hidden = true;
  });
  function SERVICES_FROM_DOM() { return Array.prototype.map.call($('service-list').querySelectorAll('.chip'), function (c) { return c.dataset.value; }); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (state.busy) return;
    var body = {
      service: state.service, date: state.date, time: state.time,
      name: $('f-name').value, phone: $('f-phone').value, email: $('f-email').value,
      rego: $('f-rego').value, notes: $('f-notes').value, website: $('f-website').value,
    };
    var fields = {};
    if (!body.service) fields.service = 'Choose a service.';
    if (!body.date) fields.date = 'Choose a day.';
    if (!body.time) fields.time = 'Choose a time.';
    if (body.name.trim().length < 2) fields.name = 'Enter your name.';
    if (body.phone.replace(/\D/g, '').length < 7) fields.phone = 'Enter a phone number we can call.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email.trim())) fields.email = 'Enter a valid email for your confirmation.';
    showErrors(fields);
    if (Object.keys(fields).length) return;

    if (state.demo) { done(null, body); return; }

    state.busy = true; $('book-btn').disabled = true; $('book-btn-label').textContent = 'Booking…';
    fetch(API + '/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 201) return done(res.j.booking, body);
        if (res.status === 409) {
          notice(res.j.error || 'That time has just been booked. Please choose another.', 'warn');
          return load(true).then(function () { state.time = null; renderTimes(); updateButton(); $('time-list').scrollIntoView({ block: 'center', behavior: 'smooth' }); });
        }
        if (res.j && res.j.fields) { showErrors(res.j.fields); return; }
        notice((res.j && res.j.error) || 'Something went wrong. Please call (04) 389 6250.', 'warn');
      })
      .catch(function () { notice('We could not reach the booking system. Please try again, or call (04) 389 6250.', 'warn'); })
      .then(function () { state.busy = false; $('book-btn').disabled = false; updateButton(); });
  });

  function done(booking, body) {
    var day = state.days.filter(function (d) { return d.date === state.date; })[0];
    var slot = day.slots.filter(function (s) { return s.time === state.time; })[0];
    $('done-when').textContent = (booking ? booking.whenLabel : day.label + ', ' + slot.label) + ' · ' + body.service;
    $('done-text').textContent = state.demo
      ? 'Preview only: this booking was not saved. When online booking is switched on, a confirmation goes to ' + body.email.trim() + '.'
      : 'We’ve emailed your confirmation and a calendar invite to ' + body.email.trim() + '. Need to change it? Call (04) 389 6250.';
    form.hidden = true; notice('');
    var d = $('book-done'); d.hidden = false; d.focus(); d.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  load(false);
})();
