-- Episode 4 Season 50 results: "Knife to the Heart" (aired Mar 18 2026)
-- Voted out: Mike White (Vatu went to Tribal Council)
-- Immunity: Cila and Kalo both won immunity; Vatu lost.

update public.episodes
set
  voted_out_player_id = 'mike-white',
  immunity_winning_tribe_id = null,
  updated_at = now()
where season = 50 and episode_number = 4;

-- Store every winning tribe for this episode so any matching user pick gets +1
insert into public.episode_immunity_tribes (episode_id, tribe_id)
select e.id, t
from public.episodes e,
     unnest(array['cila','kalo']::text[]) as t
where e.season = 50 and e.episode_number = 4
on conflict (episode_id, tribe_id) do nothing;

