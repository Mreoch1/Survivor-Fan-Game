-- Backfill profile email from auth.users so leaderboard shows names instead of "Player"
update public.profiles p
set email = u.email, updated_at = now()
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');
