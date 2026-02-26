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

Lock rules: vote-out predictions (optional) lock at a set time before each episode. Winner pick can be updated whenever your current pick is voted out.

## Auth

- Login, sign up, password reset via Supabase Auth
- Invite-by-email: inviter sends email; invitee gets link with token; sign up or login completes invite acceptance

## Data

- **Season 50 cast:** 24 players, 3 tribes with fan-voted colors: Cila (orange #e85d04), Kalo (teal #0d9488), Vatu (magenta #c026d3). Stored in app as static data. Player cards show initials when `imageUrl` is null; set `imageUrl` in `src/data/players.ts` for self-hosted or licensed photos.
- **Episodes:** Episodes table in Supabase for episode number, lock time, actual vote-out (filled after broadcast).
- **User picks:** winner_picks (current winner, can be null after vote-out), vote_out_picks (optional per episode), tribe_picks, profiles.
- **user_season_points:** Running survival points per user per season; also `weeks_survived` (current streak), `eliminations_hit`, `last_week_delta` (+1/-1 from last processed episode). **episode_points_processed:** Tracks which episodes have had points applied (idempotent).

## Decisions log

- 2026-02-25: Project created. Point system and stack chosen. SSOT added.
- 2026-02-26: Point system changed to survival: +1 per week pick stays in, -1 when voted out then repick; user_season_points table; process-episode API to apply points after each episode.
- 2026-02-25: Invite flow: store invites in Supabase; invite link contains token; signup/login with token marks invite used and links user to inviter.
- 2026-02-26: CLI-first: all setup and deploy via npm scripts, Supabase CLI, and Vercel CLI. README rewritten for terminal-only workflow.
- 2026-02-26: Leaderboard and dashboard copy aligned to survival rules: Rank, Player, Status, Current pick, Weeks survived, Eliminations hit, Total points, Last week delta; status badges SAFE / OUT – REPICK REQUIRED; home shows Current winner pick, Status this week, Points this week, Total points; "Week 1 results pending" when no episodes processed; migration 003 adds weeks_survived, eliminations_hit, last_week_delta.

## Theme music

- In-app toggle (bottom-right) uses `NEXT_PUBLIC_THEME_MUSIC_URL` if set; otherwise a default Pixabay track. For reliable playback, set a direct MP3 URL (e.g. download from [Pixabay Music – tribal](https://pixabay.com/music/search/tribal/) and host or use their direct link per license).

## TODOs / unresolved

- [ ] Add episode lock times (e.g. Wednesday 7pm ET before air) per episode in DB.
- [ ] Optional: email sending via Resend/Supabase Edge for invite emails (or copy-link for now).
- [ ] Add player photos: set `imageUrl` in `src/data/players.ts` for each player (self-host or use licensed URLs); cards show initials until then.
- [ ] At season end: set season winner and finalists for tribe/winner bonus points.
