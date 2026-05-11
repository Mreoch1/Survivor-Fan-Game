-- Allow unauthenticated visitors to read Season 50 episode rows (for public countdown UI).
-- Authenticated policy already exists; this adds anon read for this season only.

drop policy if exists "Episodes read anon season 50" on public.episodes;
create policy "Episodes read anon season 50"
on public.episodes
for select
to anon
using (season = 50);
