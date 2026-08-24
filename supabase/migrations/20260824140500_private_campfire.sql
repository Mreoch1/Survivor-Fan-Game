-- Campfire messages are private league data and are served only after the
-- application validates that the signed-in user joined the league.
drop policy if exists "Posts read" on public.posts;
drop policy if exists "Own post insert" on public.posts;
drop policy if exists "Posts server only" on public.posts;
create policy "Posts server only" on public.posts
for select to authenticated using (false);
