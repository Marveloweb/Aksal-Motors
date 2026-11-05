/**
 * Aksal Motors booking emails and calendar (Google Apps Script, free).
 *
 * The booking worker calls this web app after every booking. It:
 *   1. emails the customer a confirmation with an "add to calendar" (.ics) file
 *   2. adds the booking to this Google account's calendar
 *   3. emails the business a "New booking" notification
 *
 * Setup: paste into a new project at script.google.com while signed in to the
 * account that should send the emails (MarveloWeb for now, Aksal at launch),
 * fill in the four settings below, then Deploy > New deployment > Web app,
 * Execute as: Me, Who has access: Anyone. Copy the web app URL.
 */

// ---- settings ----
const SHARED_SECRET   = 'PASTE-THE-SAME-LONG-RANDOM-TEXT-AS-NOTIFY_SECRET';
const BUSINESS_EMAIL  = 'PASTE-THE-EMAIL-THAT-SHOULD-GET-BOOKING-ALERTS';
const BUSINESS_NAME   = 'Aksal Motors';
const BUSINESS_PHONE  = '(04) 389 6250';
const ADDRESS         = '101 Newlands Road, Newlands, Wellington 6037';
const TZ              = 'Pacific/Auckland';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SHARED_SECRET) return reply({ ok: false, error: 'not allowed' });
    const b = data.booking;
    const start = new Date(b.startsAt);
    const end = new Date(b.endsAt);
    const when = Utilities.formatDate(start, TZ, "EEEE d MMMM yyyy 'at' h:mm a");

    // 2. calendar
    CalendarApp.getDefaultCalendar().createEvent(
      b.service + ': ' + b.name + (b.rego ? ' (' + b.rego + ')' : ''),
      start, end,
      { location: ADDRESS, description: details(b, when) }
    );

    // 1. customer confirmation with .ics attachment
    MailApp.sendEmail({
      to: b.email,
      subject: 'Booking confirmed: ' + BUSINESS_NAME + ', ' + when,
      name: BUSINESS_NAME,
      replyTo: BUSINESS_EMAIL,
      htmlBody: customerHtml(b, when),
      attachments: [Utilities.newBlob(ics(b, start, end), 'text/calendar', 'aksal-motors-booking.ics')],
    });

    // 3. business notification
    MailApp.sendEmail({
      to: BUSINESS_EMAIL,
      subject: 'New booking: ' + b.service + ', ' + when,
      name: 'Aksal Motors website',
      replyTo: b.email,
      htmlBody: '<p><b>New online booking</b></p><pre style="font:14px/1.5 Arial,sans-serif">' + esc(details(b, when)) + '</pre>',
    });

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function details(b, when) {
  return [
    'When: ' + when + ' (NZ time)',
    'Service: ' + b.service,
    'Name: ' + b.name,
    'Phone: ' + b.phone,
    'Email: ' + b.email,
    'Rego: ' + (b.rego || 'not given'),
    'Notes: ' + (b.notes || 'none'),
    'Booking number: ' + b.id,
  ].join('\n');
}

function customerHtml(b, when) {
  return '<div style="font:15px/1.55 Arial,sans-serif;color:#101820;max-width:520px">' +
    '<p>Hi ' + esc(b.name.split(' ')[0]) + ',</p>' +
    '<p>Thanks for booking with ' + BUSINESS_NAME + '. Your booking is confirmed:</p>' +
    '<table style="border-collapse:collapse;margin:8px 0 16px">' +
    row('When', when) + row('Service', b.service) + (b.rego ? row('Rego', b.rego) : '') + row('Where', ADDRESS) +
    '</table>' +
    '<p>The attached file adds it to your calendar. If you need to change or cancel, just call us on <b>' + BUSINESS_PHONE + '</b> or reply to this email.</p>' +
    '<p>See you then,<br>' + BUSINESS_NAME + '</p></div>';
}
function row(k, v) {
  return '<tr><td style="padding:4px 16px 4px 0;color:#55555F">' + k + '</td><td style="padding:4px 0"><b>' + esc(v) + '</b></td></tr>';
}

function ics(b, start, end) {
  const f = d => Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  const t = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aksal Motors//Booking//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:aksal-booking-' + b.id + '@aksalmotors.co.nz',
    'DTSTAMP:' + f(new Date()),
    'DTSTART:' + f(start), 'DTEND:' + f(end),
    'SUMMARY:' + t(BUSINESS_NAME + ': ' + b.service),
    'LOCATION:' + t(ADDRESS),
    'DESCRIPTION:' + t('Booking ' + b.id + '. To change or cancel, call ' + BUSINESS_PHONE + '.'),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function reply(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run this once from the editor to approve permissions and send yourself a test. */
function testBooking() {
  const start = new Date(Date.now() + 26 * 3600 * 1000);
  doPost({ postData: { contents: JSON.stringify({ secret: SHARED_SECRET, booking: {
    id: 0, service: 'Warrant of Fitness (WoF)', name: 'Test Customer', phone: '021 000 0000',
    email: BUSINESS_EMAIL, rego: 'TEST1', notes: 'Test booking, delete me',
    startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600 * 1000).toISOString(),
  } }) } });
}
