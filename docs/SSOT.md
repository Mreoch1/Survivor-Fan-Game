# Survivor Fan Game – Single Source of Truth

**Last updated:** 2026-02-26

## Project overview

Family-and-friends web app for Survivor Season 50 (2026). Users sign up (including via email invite), pick a winner, vote each week for who gets voted out, pick a tribe, and earn points for correct predictions.

## Stack

- **Frontend/Backend:** Next.js 16 (App Router), React 19, TypeScript
- **Auth & DB:** Supabase (Auth, PostgreSQL)
- **Hosting:** Vercel
- **Theme:** Survivor-inspired (tribal, adventure); royalty-free music from Pixabay

## Point system

**1. Winner pick (survival)** — implemented

- **+1** for each week your winner pick stays in the game.
- **-1** when your pick is voted out, injured, or removed from the show; you must then pick a new winner.
- This continues until the finals. Picking the eventual winner in week 1 earns the most points; repicking after a vote-out (or injury/removal) lets you keep earning.

**2. Tribe immunity (pre-merge)** — implemented

- Each week before the merge, you pick which tribe wins immunity. Correct pick = +1 point. Set `immunity_winning_tribe_id` on the episode when results are in; process-episode awards tribe_immunity_points. Picks lock with vote-out (same episode lock).

**3. Vote-out pick** — implemented

- Each week you pick who gets voted out. Correct pick = +2 points (configurable: `POINTS_PER_CORRECT_VOTE_OUT` in `src/lib/process-episode.ts`; set to 10 if you want vote-out to weigh more). Awarded when episode is processed.

**4. Individual immunity (post-merge)** — planned

- After the merge, you pick which castaway wins individual immunity each week. Correct pick = points (e.g. +1 per episode). Requires episode-level "immunity winner" player and user picks per episode; scoring in process-episode.

**Lock rules:** All picks lock at episode start. Set a consistent "results publish time" (e.g. Friday 9:00 AM ET) so scoring updates are predictable.

## Admin

- **Who:** Any user with `profiles.is_admin = true` (set in Supabase or via SQL). Typically the group creator / first user.
- **Where:** Dashboard → Admin (link only visible to admins). Requires migration 008 (is_admin, deactivated_at, RLS).
- **Episodes:** Unlock/lock picks (set vote_out_lock_at), set voted_out_player_id and immunity_winning_tribe_id, run Process episode to apply scoring.
- **Users:** Edit display names, adjust score breakdown (survival, tribe imm., vote-out, ind. imm.), remove from group (sets deactivated_at; user is hidden from leaderboard) or restore.
- **Cast:** Eliminated players (voted_out_player_id set on an episode) show a red X overlay and "Eliminated — Episode N" on cast cards and player detail.

## Auth

- Login, sign up, password reset via Supabase Auth
- Invite-by-email: inviter sends email; invitee gets link with token; sign up or login completes invite acceptance

## Data

- **Season 50 cast:** 24 players, 3 tribes with fan-voted colors: Cila (orange #e85d04), Kalo (teal #0d9488), Vatu (magenta #c026d3). Stored in app as static data. Player cards show initials when `imageUrl` is null; set `imageUrl` in `src/data/players.ts` for self-hosted or licensed photos.
- **Episodes:** Episode number, lock time, **voted_out_player_id** (who was eliminated; required for survival scoring), **immunity_winning_tribe_id** (tribe that won immunity this episode; optional, used for tribe immunity scoring). Planned: immunity_winning_player_id (post-merge) for individual immunity.
- **User picks:** winner_picks, vote_out_picks (per episode), **tribe_immunity_picks** (user_id, episode_id, tribe_id; one per user per episode), tribe_picks (season-long tribe choice), profiles.
- **user_season_points:** Points per user per season with breakdown: `survival_points`, `tribe_immunity_points`, `individual_immunity_points`, `vote_out_points`; `points` = sum of all four. Also `weeks_survived`, `eliminations_hit`, `last_week_delta`. **episode_points_processed:** Tracks which episodes have had points applied (idempotent).

## Decisions log

- 2026-02-25: Project created. Point system and stack chosen. SSOT added.
- 2026-02-26: Point system changed to survival: +1 per week pick stays in, -1 when voted out then repick; user_season_points table; process-episode API to apply points after each episode.
- 2026-02-25: Invite flow: store invites in Supabase; invite link contains token; signup/login with token marks invite used and links user to inviter.
- 2026-02-26: CLI-first: all setup and deploy via npm scripts, Supabase CLI, and Vercel CLI. README rewritten for terminal-only workflow.
- 2026-02-26: Leaderboard and dashboard copy aligned to survival rules: Rank, Player, Status, Current pick, Weeks survived, Eliminations hit, Total points, Last week delta; status badges SAFE / OUT – REPICK REQUIRED; home shows Current winner pick, Status this week, Points this week, Total points; "Week 1 results pending" when no episodes processed; migration 003 adds weeks_survived, eliminations_hit, last_week_delta.
- 2026-02-26: Leaderboard point-system copy set to four bullets (+1 survive, -1 eliminated, repick before next episode, picks lock at episode start). Columns: Rank, Player, Current pick, Status, Last week (+1/-1/—), Repicks, Total. Status badge: SAFE or OUT, REPICK REQUIRED. Episode results section on Home and /dashboard/results page (Episode N: Boot = X). Results publish time and "only voted-out needed" documented in SSOT.
- 2026-02-26: Dashboard home page refactored for rules compliance: semantic HTML (section, h1/h2, aria-labelledby), BEM classes in globals.css (survivor-dashboard__*), no inline styles except dynamic tribe color. Focus-visible and prefers-reduced-motion in globals. Status badge copy "OUT, REPICK REQUIRED"; episode results copy "Results publish Friday 9:00 AM ET". Nav sign-out and user email use BEM classes.
- 2026-02-26: Point system expanded in SSOT: (1) winner pick survival (implemented), (2) tribe immunity pre-merge (planned), (3) individual immunity post-merge (planned). Dashboard "How scoring works" and leaderboard copy updated to describe all three. TODOs added for tribe/individual immunity schema and scoring.
- 2026-02-26: Leaderboard points breakdown: migration 004 adds `survival_points`, `tribe_immunity_points`, `individual_immunity_points` to user_season_points; `points` = sum. process-episode writes survival_points and recomputes points. Leaderboard table shows Survival, Tribe imm., Ind. imm., Total columns.
- 2026-02-26: Tribe immunity implemented: migration 005 adds `immunity_winning_tribe_id` to episodes and table `tribe_immunity_picks` (user_id, episode_id, tribe_id). Picks page: "Which tribe wins immunity?" for current episode; API saves/clears pick; same lock as vote-out. process-episode awards +1 tribe_immunity_points when episode has immunity_winning_tribe_id set. Copy updated: tribe immunity live; individual immunity "coming when the show switches."
- 2026-02-26: Vote-out pick scoring: migration 007 adds `vote_out_points` to user_season_points. process-episode awards +2 per correct vote-out pick (POINTS_PER_CORRECT_VOTE_OUT; change to 10 in code if desired). Leaderboard and dashboard copy updated.
- 2026-02-26: Admin: migration 008 adds profiles.is_admin, profiles.deactivated_at, RLS for admin update on episodes/profiles/user_season_points. Admin page at /dashboard/admin: episodes (lock, results, process), users (names, scores, remove/restore). process-episode API restricted to admins. Leaderboard excludes deactivated users. Cast cards and player detail show red X and "Eliminated — Episode N" for voted-out players.
- 2026-02-26: Leaderboard names: dashboard layout syncs current user's email to their profile on load; migration 009 backfills profile email from auth.users so existing users show email (or display_name) instead of "Player".
- 2026-02-26: Episode 1 Season 50 results: Jenna Lewis-Dougherty voted out; Vatu won immunity. Migration 010 sets voted_out_player_id and immunity_winning_tribe_id for episode 1. Run "Process episode" in Admin to update leaderboard.
- 2026-02-26: Medevac/injury support: episodes.medevac_player_id (migration 011). Same as voted out for winner-pick survival (-1, repick); vote-out points only for voted_out_player_id. Episode 1: Kyle Fraser medevac. Cast and player detail show eliminated for both voted out and medevac. Admin has Medevac dropdown. Migration 012 clears episode 1 from episode_points_processed so Process episode can be run again for both Jenna and Kyle.

## Theme music

- Self-hosted `public/audio/theme.mp3` (Kevin MacLeod – *Overworld*, CC BY). In-app toggle uses it by default; override with `NEXT_PUBLIC_THEME_MUSIC_URL`.

## Episode results and automation

- **What we need per week:** Who was eliminated (set `voted_out_player_id` on the episode). Optionally, which tribe won immunity (set `immunity_winning_tribe_id` to cila, kalo, or vatu). Injury/removal is treated the same as voted out for survival scoring. Scoring runs automatically or via manual API.
- **Results publish time:** Friday 9:00 AM ET (14:00 UTC). Vercel Cron runs `GET /api/cron/process-pending-episodes` every Friday; it processes every Season 50 episode that has `voted_out_player_id` set and is not yet in `episode_points_processed`. Idempotent.
- **Env for automation:** `SUPABASE_SERVICE_ROLE_KEY` (required for process-episode and cron). `CRON_SECRET` in Vercel (Vercel sends it when invoking the cron; route rejects requests without it).
- **Manual trigger:** `POST /api/process-episode` with body `{ "episodeId": "uuid" }` (logged-in user; uses service role under the hood).

## Troubleshooting

- **Email confirmation "Cannot connect to the server":** Supabase **Authentication → URL Configuration** must have **Site URL** set to the production app URL and **Redirect URLs** including `https://<your-app>/auth/callback` and `https://<your-app>/**`. See `docs/troubleshooting.md`.

## TODOs / unresolved

- [ ] Add episode lock times (e.g. Wednesday 7pm ET before air) per episode in DB.
- [ ] Individual immunity (post-merge): add episode field (e.g. immunity_winning_player_id), user pick per episode, and scoring in process-episode. Implement when the show switches to individual phase.
- [ ] Optional: email sending via Resend/Supabase Edge for invite emails (or copy-link for now).
- Themed auth emails: copy HTML from `docs/email-templates/` into Supabase Dashboard → Authentication → Email Templates (Confirm signup, Reset password, Invite, Magic link). See `docs/email-templates/README.md`.
- [ ] Optional: set `imageUrl` in `src/data/players.ts` for real cast photos (licensed/self-hosted); cards use DiceBear Initials (CC0) until then.
- [ ] At season end: set season winner and finalists for tribe/winner bonus points.
