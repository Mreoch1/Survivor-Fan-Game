-- Admin role and soft-remove from group (group creator / first user can be set as admin in Supabase)

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists deactivated_at timestamptz;

comment on column public.profiles.is_admin is 'If true, user can access /dashboard/admin and manage episodes, users, scoring.';
comment on column public.profiles.deactivated_at is 'When set, user is removed from group: hidden from leaderboard and picks. Admin can clear to restore.';

-- RLS: allow admins to update episodes (lock, voted_out, immunity) and other users' profiles and points
create or replace function public.is_admin() returns boolean as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$ language sql security definer stable;

-- Episodes: admins may update (for lock times and results)
drop policy if exists "Episodes update admin" on public.episodes;
create policy "Episodes update admin" on public.episodes for update using (public.is_admin());

-- Profiles: admins may update any profile (display_name, deactivated_at, is_admin)
drop policy if exists "Profiles update admin" on public.profiles;
create policy "Profiles update admin" on public.profiles for update using (public.is_admin());

-- user_season_points: admins may update any row (for score adjustments)
drop policy if exists "User season points update admin" on public.user_season_points;
create policy "User season points update admin" on public.user_season_points for update using (public.is_admin());
