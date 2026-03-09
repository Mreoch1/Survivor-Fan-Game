-- Episode 2 Season 50 results: "Therapy Carousel" (aired Mar 4 2026)
-- Voted out: Savannah Louie (unanimous; Cila went to Tribal Council)
-- Immunity: Kalo and Vatu both had immunity; Cila lost. App stores a single
-- immunity_winning_tribe_id per episode, so we leave it null for this episode
-- (no tribe immunity points awarded). Run "Process episode" in Admin after this.

update public.episodes
set
  voted_out_player_id = 'savannah-louie',
  immunity_winning_tribe_id = null,
  updated_at = now()
where season = 50 and episode_number = 2;
