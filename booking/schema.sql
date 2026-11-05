-- Already applied to the D1 database "aksal-bookings" (5 Nov 2026).
-- Re-run safely with: npx wrangler d1 execute aksal-bookings --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_date TEXT NOT NULL,           -- NZ date, YYYY-MM-DD
  slot_time TEXT NOT NULL,           -- NZ time, HH:MM
  starts_at TEXT NOT NULL,           -- same moment in UTC
  service TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  rego TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',   -- set to 'cancelled' to free the slot again
  notified TEXT,                              -- result of the email/calendar step
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
-- One confirmed booking per slot: a second booking for the same time is refused.
CREATE UNIQUE INDEX IF NOT EXISTS one_booking_per_slot ON bookings(slot_date, slot_time) WHERE status = 'confirmed';
