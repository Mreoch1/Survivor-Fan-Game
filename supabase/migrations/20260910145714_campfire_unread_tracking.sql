-- Server-managed, per-account Campfire activity cursor. Existing posts start unread.
alter table public.profiles add column campfire_read_at timestamptz;
