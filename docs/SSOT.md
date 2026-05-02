# Survivor Fan Game – Single Source of Truth

**Last updated:** 2026-05-02

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

- Each week before the merge, you pick which tribe wins immunity. Correct pick = +1 point. Set `episode_immunity_tribes` (one row per winning tribe) on the episode when results are in; process-episode awards tribe_immunity_points for matching picks. Picks lock with vote-out (same episode lock).

**3. Vote-out pick** — implemented

- Each week you pick who gets voted out. Correct pick = +2 points (configurable: `POINTS_PER_CORRECT_VOTE_OUT` in `src/lib/process-episode.ts`; set to 10 if you want vote-out to weigh more). Awarded when episode is processed.

**4. Individual immunity (post-merge)** — planned

- After the merge, you pick which castaway wins individual immunity each week. Correct pick = points (e.g. +1 per episode). Requires episode-level "immunity winner" player and user picks per episode; scoring in process-episode.

**Lock rules:** All picks lock at episode start. **`vote_out_lock_at`** is stored as **timestamptz** (absolute instant). Everywhere in the app, lock times are shown and edited as **US Eastern (`America/New_York`, EST/EDT)** so the group has one clock, not each user’s browser timezone. Admin uses a text field `YYYY-MM-DDTHH:mm` interpreted as Eastern; see `src/lib/eastern-time.ts`.

## Admin

- **Who:** Any user with `profiles.is_admin = true` (set in Supabase or via SQL). Typically the group creator / first user.
- **Where:** Dashboard → Admin (link only visible to admins). Requires migration 008 (is_admin, deactivated_at, RLS).
- **Episodes:** Unlock/lock picks (set vote_out_lock_at), set voted_out_player_id (and second/third boot if needed) and `episode_immunity_tribes` (tribes that won immunity that episode), run Process episode to apply scoring. Admin Episodes UI is a **card per episode** (no horizontal scroll): lock row, responsive grid for Vote-out 1–3 and Medevac, tribe immunity row, Save and Process. BEM: `survivor-admin-episodes__*`. Boot selects use full-name `title` when a value is selected.
- **Users:** Edit display names, adjust score breakdown (survival, tribe imm., vote-out, ind. imm.), remove from group (sets deactivated_at; user is hidden from leaderboard) or restore.
- **Picks:** Dedicated admin picks tab with an episode selector to audit everyone’s winner pick, vote-out pick, and tribe immunity pick for appeals/questions.
- **Cast:** Eliminated players (voted_out_player_id set on an episode) show a red X overlay and "Eliminated — Episode N" on cast cards and player detail.

## Auth

- Login, sign up, password reset via Supabase Auth
- Invite-by-email: inviter sends email; invitee gets link with token; sign up or login completes invite acceptance

## Data

- **Season 50 cast:** 24 players, 3 tribes. Post-swap (Episode 3): Cila (yellow #eab308), Kalo (blue #2563eb), Vatu (red #dc2626). Stored in app as static data. Player cards show initials when `imageUrl` is null; set `imageUrl` in `src/data/players.ts` for self-hosted or licensed photos.
- **Episodes:** Episode number, lock time, **voted_out_player_id**, optional **second_voted_out_player_id** and **third_voted_out_player_id** for double/triple boots, **medevac_player_id** (optional). **episode_immunity_tribes** (episode_id, tribe_id): one row per tribe that won immunity; users who picked any of those tribes get +1. Planned: immunity_winning_player_id (post-merge) for individual immunity.
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
- 2026-02-26: Tribe immunity implemented (v1): migration 005 adds `immunity_winning_tribe_id` to episodes and table `tribe_immunity_picks` (user_id, episode_id, tribe_id). process-episode awards +1 tribe_immunity_points based on that field; later updated to multi-tribe winners via `episode_immunity_tribes`.
- 2026-02-26: Vote-out pick scoring: migration 007 adds `vote_out_points` to user_season_points. process-episode awards +2 per correct vote-out pick (POINTS_PER_CORRECT_VOTE_OUT; change to 10 in code if desired). Leaderboard and dashboard copy updated.
- 2026-02-26: Admin: migration 008 adds profiles.is_admin, profiles.deactivated_at, RLS for admin update on episodes/profiles/user_season_points. Admin page at /dashboard/admin: episodes (lock, results, process), users (names, scores, remove/restore). process-episode API restricted to admins. Leaderboard excludes deactivated users. Cast cards and player detail show red X and "Eliminated — Episode N" for voted-out players.
- 2026-02-26: Leaderboard names: dashboard layout syncs current user's email to their profile on load; migration 009 backfills profile email from auth.users so existing users show email (or display_name) instead of "Player".
- 2026-02-26: Episode 1 Season 50 results: Jenna Lewis-Dougherty voted out; Vatu won immunity. Migration 010 sets voted_out_player_id and immunity_winning_tribe_id for episode 1. Run "Process episode" in Admin to update leaderboard.
- 2026-02-26: Medevac/injury support: episodes.medevac_player_id (migration 011). Same as voted out for winner-pick survival (-1, repick); vote-out points only for voted_out_player_id. Episode 1: Kyle Fraser medevac. Cast and player detail show eliminated for both voted out and medevac. Admin has Medevac dropdown. Migration 012 clears episode 1 from episode_points_processed so Process episode can be run again for both Jenna and Kyle.
- 2026-02-26: Episode 2 Season 50: migration 014 inserts episode 2 with vote_out_lock_at = 2026-03-04 20:00:00-05 (Wed 8 PM ET, when "Therapy Carousel" airs). My picks shows tribe immunity and vote-out for the first episode with no voted_out_player_id (episode 2). Picks page treats medevac players as eliminated for winner dropdown (inGamePlayers excludes both voted_out and medevac).
- 2026-03-09: Episode 2 Season 50 results: migration 015 sets voted_out_player_id = Savannah Louie. Immunity: Kalo and Vatu both won; multi-tribe immunity is stored in `episode_immunity_tribes` (and points are backfilled via migration 020).
- 2026-03-09: Episode 3 Season 50: migration 016 inserts episode 3 "Did You Vote for a Swap?" with vote_out_lock_at = 2026-03-11 20:00:00-05 (Wed 8 PM ET). My picks page now shows tribe immunity and vote-out for episode 3.
- 2026-03-12: Episode 3 Season 50 results: migration 017 sets voted_out_player_id = Q Burdette. Immunity: Cila and Kalo won; multi-tribe immunity is stored in `episode_immunity_tribes` (and points are backfilled via migration 020). Migration 018 adds episode 4 (Mar 18 2026) for next picks.
- 2026-03-12: Multiple immunity-winning tribes: migration 019 adds episode_immunity_tribes (episode_id, tribe_id). Process-episode awards +1 to any user whose tribe pick is in that set. Admin uses checkboxes (Cila, Kalo, Vatu) per episode. Migration 020 backfills tribe immunity points for ep2 (Kalo, Vatu) and ep3 (Cila, Kalo).
- 2026-03-19: Episode 4 Season 50 results: migration 021 sets voted_out_player_id = Mike White (Vatu Tribal) and inserts episode_immunity_tribes for Cila and Kalo.
- 2026-03-19: Episode 5 Season 50: migration 022 inserts Episode 5 vote_out_lock_at so “My picks” can advance to the next week.
- 2026-04-01: Episode 5 Season 50 results (migration 024): set `voted_out_player_id = angelina-keeley` and immunity winner `kalo` (`episode_immunity_tribes`) so Episode 5 is process-ready.
- 2026-04-01: Episode 6 Season 50: migration 023 inserts Episode 6 vote_out_lock_at = 2026-04-01 20:00:00-05 (Wed 8 PM ET) so “My picks” advances to the latest episode.
- 2026-04-02: Migration 028 sets Episode 6 `vote_out_lock_at` to 2026-04-08 20:00:00-05 (Wed 8 PM ET) so picks stay unlocked after the original Apr 1 lock passed.
- 2026-04-02: Episode 7 Season 50: migration 029 inserts Episode 7 (lock Wed 8 PM ET). **Correction:** lock is **2026-04-08 20:00:00-05** (not Apr 15); migration 032 updates existing DBs; 029 text/insert amended for fresh installs.
- 2026-04-07: Triple-elimination support (migration 030): `episodes.third_voted_out_player_id`. Episode 6 results (migration 031): Kamilla Karthigesu, Genevieve Mushaluk, Colby Donaldson; clears `episode_immunity_tribes` for that week (merge / individual immunity). Clears `episode_points_processed` for Episode 6 so Admin can run Process episode once.
- 2026-04-07: Admin Episodes table: dedicated columns for Vote-out 1, 2, and 3 (plus Medevac, tribe immunity, Save, Process) with HTML `form` association so one Save submits all vote-out fields.
- 2026-04-07: Admin Episodes: banner when DB lacks second/third boot columns; table `minWidth` and copy to scroll horizontally; detect columns via `episodes.some` for robustness.
- 2026-04-08: Admin Episodes layout: wired `survivor-admin-episodes` BEM classes on the page, scroll hint, `tabIndex` on scroll area for keyboard focus, removed boot column `max-width` so long names are not clipped; focus-visible ring on scroll container.
- 2026-04-08: Admin Episodes UI replaced wide scrollable table with a full-width card list per episode so controls fit without a horizontal scrollbar (responsive grid for vote-outs and medevac).
- 2026-04-08: Lock times are standardized on **US Eastern** for display (My Picks) and admin editing; `src/lib/eastern-time.ts` formats and parses `YYYY-MM-DDTHH:mm` as `America/New_York`. DB still uses timestamptz.
- 2026-04-09: Admin Episodes lock input sizing polished: constrained lock field width/height and aligned lock button to prevent oversized lock control; fixed HTML pattern escaping for `YYYY-MM-DDTHH:mm` validation.
- 2026-04-09: Admin lock editor made sleeker and stable across browsers: replaced single free-text lock field with compact `date` + `time` controls (still parsed/saved as Eastern) to prevent oversized rendering.
- 2026-04-09: Mobile polish: explicit `viewport` (`device-width`, `viewport-fit: cover`), safe-area padding on header/main, admin Episodes responsive stack (lock row, vote-outs single column, full-width actions), 16px form controls in admin to avoid iOS zoom, larger tap targets.
- 2026-04-09: App-wide mobile pass: header stacks with full-width sign-out; `survivor-table-scroll` on leaderboard/admin tables; cast grid uses `min(160px,100%)`; player detail stacks photo; invite/display-name rows stack; global `1rem` inputs and `2.75rem` min button height in dashboard main; landing `survivor-page` and music FAB respect safe-area; `html` text-size-adjust.
- 2026-04-09: Leaderboard on viewports under 1024px uses a **card list** (`survivor-leaderboard__*`) with all columns visible vertically; wide table remains from 1024px up so phones do not need horizontal scroll to read ranks and points.
- 2026-04-08: `npm run db:push` script uses `supabase db push --yes` (linked project). `scripts/db-push.sh` calls the same without requiring Node; optional `SUPABASE_DB_PASSWORD` if needed.
- 2026-04-01: Double-elimination support (migrations 025/026): added `episodes.second_voted_out_player_id`, updated Episode 5 second boot to `charlie-davis`, and cleared Episode 5 from `episode_points_processed` so scoring can be re-run with both eliminations counted.
- 2026-04-01: Migration 027 re-opens Episode 5 for processing again after deploying updated double-elimination app logic, ensuring Charlie is counted when Episode 5 is reprocessed.
- 2026-04-14: Episode 7 Season 50 results + Episode 8 unlock (migration 033): set Episode 7 `voted_out_player_id = dee-valladares`, clear any Episode 7 `episode_immunity_tribes` rows (post-merge individual immunity phase), clear Episode 7 from `episode_points_processed` for reprocessing, and insert Episode 8 lock at 2026-04-15 20:00 ET.
- 2026-04-14: Picks/admin post-merge behavior: from Episode 7 onward, tribe immunity picks are no longer required in My Picks, tribe-immunity save calls are ignored/cleared server-side, and admin Episode cards/picks view show tribe immunity as pre-merge only.
- 2026-04-14: Manual Episode 7 adjudication (migration 034): awarded +1 `tribe_immunity_points` to users who picked Ozzy's tribe (`vatu`) for Episode 7, and recomputed `points` totals for those users.
- 2026-04-14: Individual immunity is now implemented (migration 035 + app wiring): added `episodes.immunity_winning_player_id`, created `individual_immunity_picks` with RLS, switched My Picks post-merge UI from tribe immunity to immunity winner pick, added API save/delete logic for individual picks, added admin result field for individual immunity winner, and process-episode now awards +1 `individual_immunity_points` for correct picks.
- 2026-04-21: Episode 8 Season 50 results + Episode 9 unlock (migration 036): set Episode 8 `voted_out_player_id = benjamin-coach-wade`, `second_voted_out_player_id = chrissy-hofbeck`, cleared Episode 8 `episode_immunity_tribes` rows, cleared Episode 8 from `episode_points_processed`, and inserted Episode 9 lock at 2026-04-22 20:00 ET. Episode 8 immunity used a duo-winner twist, so `immunity_winning_player_id` remains null for this week.
- 2026-04-21: Leaderboard score reconciliation (migration 037): recomputed Season 50 `vote_out_points`, `tribe_immunity_points`, and `individual_immunity_points` from picks/results source tables, preserved `survival_points`, and recomputed `points` totals. Includes the Episode 7 manual tribe bonus rule (+1 for `vatu` picks).
- 2026-04-21: Winner pick auditability (migration 038 + API): added `winner_pick_history` table (user_id, season, episode_id, previous_player_id, player_id, source, created_at) with RLS (own read/insert + admin read). `/api/picks` now writes a history row whenever a user's winner pick actually changes.
- 2026-04-21: Leaderboard clarity pass: updated copy and labels so point totals are easier to parse. Added explicit formula text (`Total = Survival + Tribe + Vote-out + Individual`) and per-player formula display on desktop/mobile cards, plus clearer component column labels with point weights.
- 2026-04-27: Episode 9 Season 50 results + Episode 10 unlock (migration 039): set Episode 9 `voted_out_player_id = christian-hubicki`, `immunity_winning_player_id = joe-hunter`, cleared any Episode 9 `episode_immunity_tribes` rows, cleared Episode 9 from `episode_points_processed` for idempotent replay, and inserted Episode 10 lock at 2026-04-29 20:00 ET.
- 2026-04-27: Automation schedule changed: Vercel cron for `GET /api/cron/process-pending-episodes` now runs every Sunday 9:00 PM EST (`0 2 * * 1` UTC schedule).
- 2026-04-27: Theme color options removed: deleted `ThemePicker` UI and related `data-theme` overrides. App now always uses the default Survivor palette.
- 2026-04-29: Episode 10 picks unlocked (migration 040): set `vote_out_lock_at` to 2026-05-06 20:00 ET (Wed 8 PM ET) so My Picks stays open after the prior Episode 10 lock passed.
- 2026-05-02: Episode 10 Season 50 results + Episode 11 unlock (migration 041): set Episode 10 `voted_out_player_id = stephenie-lagrossa-kendrick`, `immunity_winning_player_id = tiffany-ervin`, cleared any Episode 10 `episode_immunity_tribes` rows, cleared Episode 10 from `episode_points_processed` for idempotent replay, and inserted Episode 11 lock at 2026-05-13 20:00 ET.
- 2026-05-02: Leaderboard UI: removed per-row additive formula under Total (desktop and mobile); category columns and top “How totals are calculated” section remain.
- 2026-04-14: Admin Picks tab and copy aligned to post-merge behavior: episode picks table now shows individual immunity picks for Episode 7+ (instead of N/A), latest activity tracks latest individual pick in post-merge weeks, and leaderboard point-system copy removed "coming soon" for individual immunity.
- 2026-03-23: Admin page now has tabbed sections (Episodes, Users, Picks). New Picks tab shows all users and their winner pick plus per-episode vote-out and tribe immunity picks, with episode filter for adjudicating appeals/questions.
- 2026-03-23: Cast page tribe section headers now color the tribe name text itself (not just the border) so labels like Vatu clearly match their team color.
- 2026-03-09: Tribe swap (Episode 3): Updated players.ts with post-swap tribes from Survivor Fandom wiki. New Cila (yellow): Charlie, Cirie, Dee, Jonathan, Kamilla, Rick, Rizo. New Kalo (blue): Aubry, Chrissy, Coach, Colby, Genevieve, Joe, Tiffany. New Vatu (red): Angelina, Christian, Emily, Mike, Ozzy, Q, Stephenie. Eliminated (Jenna, Kyle, Savannah) remain in original tribes for cast display.

## Theme music

- Self-hosted `public/audio/theme.mp3` (Kevin MacLeod – *Overworld*, CC BY). In-app toggle uses it by default; override with `NEXT_PUBLIC_THEME_MUSIC_URL`.

## Episode results and automation

- **What we need per week:** Who was eliminated (set `voted_out_player_id` on the episode). Optionally, which tribe(s) won immunity (set `episode_immunity_tribes` rows for the winning tribe_id(s)). Injury/removal is treated the same as voted out for survival scoring. Scoring runs automatically or via manual API.
- **Results publish time:** Sunday 9:00 PM EST (Monday 02:00 UTC). Vercel Cron runs `GET /api/cron/process-pending-episodes` weekly at that time; it processes every Season 50 episode that has `voted_out_player_id` set and is not yet in `episode_points_processed`. Idempotent.
- **Env for automation:** `SUPABASE_SERVICE_ROLE_KEY` (required for process-episode and cron). `CRON_SECRET` in Vercel (Vercel sends it when invoking the cron; route rejects requests without it).
- **Manual trigger:** `POST /api/process-episode` with body `{ "episodeId": "uuid" }` (logged-in user; uses service role under the hood).

## Troubleshooting

- **`npm run db:push` → `env: node: No such file or directory`:** Use the Supabase CLI only: **`./scripts/db-push.sh`** (or ensure `/opt/homebrew/bin` is on `PATH` and run **`supabase db push --yes`** from the repo). With a **linked** project and `supabase login`, no database password is required. `package.json` `db:push` is now `supabase db push --yes` (still needs Node if you invoke it via `npm run`).
- **Email confirmation "Cannot connect to the server":** Supabase **Authentication → URL Configuration** must have **Site URL** set to the production app URL and **Redirect URLs** including `https://<your-app>/auth/callback` and `https://<your-app>/**`. See `docs/troubleshooting.md`.

## TODOs / unresolved

- [ ] Add episode lock times (e.g. Wednesday 7pm ET before air) per episode in DB.
- [ ] Backfill/confirm Episode 7+ `immunity_winning_player_id` values in Admin so process-episode can award individual immunity points correctly each week (leave null for special multi-winner twist weeks like Episode 8, unless scoring rules change).
- [ ] Optional: email sending via Resend/Supabase Edge for invite emails (or copy-link for now).
- Themed auth emails: copy HTML from `docs/email-templates/` into Supabase Dashboard → Authentication → Email Templates (Confirm signup, Reset password, Invite, Magic link). See `docs/email-templates/README.md`.
- [ ] Optional: set `imageUrl` in `src/data/players.ts` for real cast photos (licensed/self-hosted); cards use DiceBear Initials (CC0) until then.
- [ ] At season end: set season winner and finalists for tribe/winner bonus points.
