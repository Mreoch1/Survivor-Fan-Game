create index idx_picks_carried_from on public.picks(carried_from_episode_id);
create index idx_posts_user on public.posts(user_id);
create index idx_invites_created_by on public.invites(created_by);

-- Explicit deny policies document that these tables are server-only while
-- keeping RLS as defense in depth.
create policy "Episode results server only" on public.episode_results
for select to authenticated using (false);
create policy "Invites server only" on public.invites
for select to authenticated using (false);
