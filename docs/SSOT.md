# Survivor Fan Game – Single Source of Truth

**Last updated:** 2026-02-25

## Project overview

Family-and-friends web app for Survivor Season 50 (2026). Users sign up (including via email invite), pick a winner, vote each week for who gets voted out, pick a tribe, and earn points for correct predictions.

## Stack

- **Frontend/Backend:** Next.js 16 (App Router), React 19, TypeScript
- **Auth & DB:** Supabase (Auth, PostgreSQL)
- **Hosting:** Vercel
- **Theme:** Survivor-inspired (tribal, adventure); royalty-free music from Pixabay

## Point system (survival)

- **+1** for each week your winner pick stays in the game.
- **-1** when your pick is voted out; you must then pick a new winner.
- This continues until the finals. Picking the eventual winner in week 1 earns the most points; repicking after a vote-out lets you keep earning.

Lock rules: picks lock at episode start. Set a consistent "results publish time" (e.g. Friday 9:00 AM ET) so scoring updates are predictable.

## Auth

- Login, sign up, password reset via Supabase Auth
- Invite-by-email: inviter sends email; invitee gets link with token; sign up or login completes invite acceptance

## Data

- **Season 50 cast:** 24 players, 3 tribes with fan-voted colors: Cila (orange #e85d04), Kalo (teal #0d9488), Vatu (magenta #c026d3). Stored in app as static data. Player cards show initials when `imageUrl` is null; set `imageUrl` in `src/data/players.ts` for self-hosted or licensed photos.
- **Episodes:** Episodes table in Supabase for episode number, lock time, and **voted_out_player_id** (the only field required for scoring: who was eliminated that week). Reward/immunity are optional for future side games.
- **User picks:** winner_picks (current winner, can be null after vote-out), vote_out_picks (optional per episode), tribe_picks, profiles.
- **user_season_points:** Running survival points per user per season; also `weeks_survived` (current streak), `eliminations_hit`, `last_week_delta` (+1/-1 from last processed episode). **episode_points_processed:** Tracks which episodes have had points applied (idempotent).

## Decisions log

- 2026-02-25: Project created. Point system and stack chosen. SSOT added.
- 2026-02-26: Point system changed to survival: +1 per week pick stays in, -1 when voted out then repick; user_season_points table; process-episode API to apply points after each episode.
- 2026-02-25: Invite flow: store invites in Supabase; invite link contains token; signup/login with token marks invite used and links user to inviter.
- 2026-02-26: CLI-first: all setup and deploy via npm scripts, Supabase CLI, and Vercel CLI. README rewritten for terminal-only workflow.
- 2026-02-26: Leaderboard and dashboard copy aligned to survival rules: Rank, Player, Status, Current pick, Weeks survived, Eliminations hit, Total points, Last week delta; status badges SAFE / OUT – REPICK REQUIRED; home shows Current winner pick, Status this week, Points this week, Total points; "Week 1 results pending" when no episodes processed; migration 003 adds weeks_survived, eliminations_hit, last_week_delta.
- 2026-02-26: Leaderboard point-system copy set to four bullets (+1 survive, -1 eliminated, repick before next episode, picks lock at episode start). Columns: Rank, Player, Current pick, Status, Last week (+1/-1/—), Repicks, Total. Status badge: SAFE or OUT, REPICK REQUIRED. Episode results section on Home and /dashboard/results page (Episode N: Boot = X). Results publish time and "only voted-out needed" documented in SSOT.

## Theme music

- Self-hosted `public/audio/theme.mp3` (Kevin MacLeod – *Overworld*, CC BY). In-app toggle uses it by default; override with `NEXT_PUBLIC_THEME_MUSIC_URL`.

## Episode results and automation

- **What we need per week:** Only who was eliminated (voted out / quit / medevac). Set `voted_out_player_id` on the episode, then call `POST /api/process-episode` with that episode id.
- **Results publish time:** Pick a consistent time (e.g. Friday 9:00 AM ET) and document it so players trust when scoring updates.
- **Options:** (A) Automated: fetch recap pages, AI extracts boot, verify with 2+ sources and cast list, then publish or flag for manual approval. (B) Semi-automatic: you enter "Voted out: [name]" each week; scoring and repicks are automatic. (C) Fully manual: enter all episode fields. For current gameplay, (B) is lowest effort and very reliable.

## TODOs / unresolved

- [ ] Add episode lock times (e.g. Wednesday 7pm ET before air) per episode in DB.
- [ ] Optional: email sending via Resend/Supabase Edge for invite emails (or copy-link for now).
- Themed auth emails: copy HTML from `docs/email-templates/` into Supabase Dashboard → Authentication → Email Templates (Confirm signup, Reset password, Invite, Magic link). See `docs/email-templates/README.md`.
- [ ] Optional: set `imageUrl` in `src/data/players.ts` for real cast photos (licensed/self-hosted); cards use DiceBear Initials (CC0) until then.
- [ ] At season end: set season winner and finalists for tribe/winner bonus points.
