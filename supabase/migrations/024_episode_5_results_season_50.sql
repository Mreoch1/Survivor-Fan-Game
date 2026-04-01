-- Episode 5 Season 50 results: "Open Wounds" (aired Mar 25 2026)
-- Double elimination reported; primary boot is recorded here.
-- Immunity: Kalo won.

update public.episodes
set
  voted_out_player_id = 'angelina-keeley',
  immunity_winning_tribe_id = null,
  updated_at = now()
where season = 50 and episode_number = 5;

insert into public.episode_immunity_tribes (episode_id, tribe_id)
select e.id, 'kalo'
from public.episodes e
where e.season = 50 and e.episode_number = 5
on conflict (episode_id, tribe_id) do nothing;

