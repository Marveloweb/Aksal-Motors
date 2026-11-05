# Aksal Motors online booking

Free setup: a Cloudflare Worker and D1 database for the bookings, and a Google Apps Script for the emails and calendar.

## How it works
1. `book.html` shows the free times (Mon to Fri, 8 am to 4 pm starts, 1 hour each, up to 3 weeks ahead, at least 2 hours' notice). All times are New Zealand time, with daylight saving handled automatically.
2. A booking is saved in the D1 database `aksal-bookings`. The database allows only one confirmed booking per time, so a taken time shows as **Booked** for everyone, and two people can never get the same slot.
3. The worker then calls the Google script, which:
   - emails the customer a confirmation with an "add to calendar" file;
   - adds the booking to the Google Calendar of the account the script runs under;
   - emails the business a "New booking" alert.
4. If the worker can't be reached, `book.html` runs in a clearly labelled preview mode and saves nothing.

## Already done
- D1 database `aksal-bookings` created in Oceania, with the table and the one-booking-per-slot rule (`schema.sql`).
- Worker code (`src/index.js`) and config (`wrangler.toml`), tested end to end.
- The site points at `https://aksal-booking.twilight-frog-a541.workers.dev`.

## Setup (about 15 minutes)
1. **Google script** (signed in as Noah's Google account):
   - Go to script.google.com and create a new project. Paste in `google-script/Code.gs`.
   - Fill in `SHARED_SECRET` (any long random text) and `BUSINESS_EMAIL` (where booking alerts go).
   - Run `testBooking` once and approve the permissions. You should get a test confirmation, a test alert and a calendar entry.
   - Go to Deploy > New deployment > Web app, with **Execute as: Me** and **Who has access: Anyone**. Copy the web app URL.
2. **Worker** (on the computer you use for `marveloweb-api`), from this `booking` folder:
   ```
   npx wrangler deploy
   npx wrangler secret put NOTIFY_URL      # paste the web app URL
   npx wrangler secret put NOTIFY_SECRET   # paste the same SHARED_SECRET
   ```
3. Open `book.html`. The yellow preview notice disappears, and real bookings start.

## Day to day
- **See bookings:** Cloudflare dashboard > Storage & Databases > D1 > aksal-bookings > `bookings` table, or check the Google Calendar.
- **Cancel or free a slot:** run `UPDATE bookings SET status = 'cancelled' WHERE id = <number>;` in the D1 console. The slot shows as free again.
- **Change hours, slots or services:** edit `SETTINGS` at the top of `src/index.js` (and the matching lists in `assets/js/book.js`), then `npx wrangler deploy`.

## At launch on aksalmotors.co.nz
- Redeploy the Google script under Aksal's Google account (or set `BUSINESS_EMAIL` to their email), so the calendar and emails are theirs. Then update `NOTIFY_URL` and `NOTIFY_SECRET`.
- Add the live domain to `ALLOWED_ORIGINS` in `wrangler.toml` if it changes, and redeploy.
- Public holidays aren't blocked automatically yet. Ask us to add a holiday list before launch.

## Free limits
Cloudflare Workers free plan: 100,000 requests a day. D1 free plan: 5 GB storage. Google Apps Script email: 100 a day on a free Gmail account and 1,500 a day on Google Workspace. Each booking uses 2 emails.
