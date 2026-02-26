# Survivor Fan Game – Single Source of Truth

**Last updated:** 2026-02-25

## Project overview

Family-and-friends web app for Survivor Season 50 (2026). Users sign up (including via email invite), pick a winner, vote each week for who gets voted out, pick a tribe, and earn points for correct predictions.

## Stack

- **Frontend/Backend:** Next.js 16 (App Router), React 19, TypeScript
- **Auth & DB:** Supabase (Auth, PostgreSQL)
- **Hosting:** Vercel
- **Theme:** Survivor-inspired (tribal, adventure); royalty-free music from Pixabay

## Point system

| Action | Points |
|--------|--------|
| Correct vote-out prediction (per episode) | 15 |
| Correct season winner pick | 100 |
| Tribe pick: your tribe has the winner | 25 |
| Tribe pick: your tribe has a finalist (2nd/3rd) | 10 each |

Lock rules: winner pick locked at season start; vote-out picks lock at a set time before each episode (configurable).

## Auth

- Login, sign up, password reset via Supabase Auth
- **Game code:** optional `GAME_CODE` env var; when set, signup requires the code (share with family/friends).
- Invite-by-email: inviter sends email; invitee gets link with token; sign up or login completes invite acceptance

## Data

- **Season 50 cast:** 24 players, 3 tribes (Cila – orange, Kalo, Vatu). Stored in app as static data; face card images use placeholder or CBS-hosted URLs where legal.
- **Episodes:** Episodes table in Supabase for episode number, lock time, actual vote-out (filled after broadcast).
- **User picks:** winner_picks, vote_out_picks (per episode), tribe_picks, profiles.

## Decisions log

- 2026-02-25: Project created. Point system and stack chosen. SSOT added.
- 2026-02-25: Invite flow: store invites in Supabase; invite link contains token; signup/login with token marks invite used and links user to inviter.

## Theme music

- In-app toggle uses `NEXT_PUBLIC_THEME_MUSIC_URL` if set; otherwise a placeholder.
- Use royalty-free tribal/adventure music (e.g. [Pixabay Music – tribal](https://pixabay.com/music/search/tribal/)). Download and host or use a direct MP3 link per license.

## TODOs / unresolved

- [ ] Add episode lock times (e.g. Wednesday 7pm ET before air) per episode in DB.
- [ ] Optional: email sending via Resend/Supabase Edge for invite emails (or copy-link for now).
- [ ] Replace player image placeholders with approved assets if needed.
- [ ] At season end: set season winner and finalists for tribe/winner bonus points.
