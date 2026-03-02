-- Allow admins to insert user_season_points rows (e.g. when manually setting scores for users who don't have a row yet).
-- Without this, admin "Save scores" fails with RLS violation when upserting for a user with no existing row.

create policy "User season points insert admin" on public.user_season_points
  for insert with check (public.is_admin());
