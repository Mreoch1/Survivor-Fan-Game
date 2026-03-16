-- Episode 3 Season 50 results: "Did You Vote for a Swap?" (aired Mar 11 2026)
-- Voted out: Q Burdette (Vatu went to Tribal Council)
-- Immunity: Vatu lost; Cila and Kalo had immunity. Schema has one tribe per episode, so
-- immunity_winning_tribe_id left null (no tribe immunity points). Run "Process episode" in Admin after this.

update public.episodes
set
  voted_out_player_id = 'quintavius-q-burdette',
  immunity_winning_tribe_id = null,
  updated_at = now()
where season = 50 and episode_number = 3;
