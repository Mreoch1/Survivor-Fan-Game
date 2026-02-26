# Survivor Fan Game

Family and friends prediction game for **Survivor Season 50** (2026). Users sign up (including via email invite), pick the season winner, choose a tribe, vote each week for who gets voted out, and earn points for correct predictions.

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Supabase** (auth, PostgreSQL)
- **Vercel** (hosting)

## Features

- **Auth:** Sign up, sign in, password reset (Supabase)
- **Invites:** Create invite link by email; share link; invitee signs up or signs in with the link
- **Cast:** Full Season 50 cast (24 players, 3 tribes: Cila, Kalo, Vatu) with face cards and accomplishments
- **Picks:** Winner pick, tribe pick, weekly vote-out prediction (locks before each episode)
- **Points:** 15 per correct vote-out, 100 for correct winner, 25 if your tribe has the winner, 10 per tribe finalist
- **Leaderboard:** Live standings
- **Theme:** Survivor-style UI and optional royalty-free theme music

## Setup

### 1. Clone and install

```bash
cd survivor-fan-app
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the migration:  
   Copy and run the contents of `supabase/migrations/001_initial.sql`.
3. In **Authentication → URL Configuration**, set:
   - **Site URL:** `http://localhost:3000` (dev) or your Vercel URL (prod)
   - **Redirect URLs:** add `http://localhost:3000/auth/callback` and `https://your-domain.vercel.app/auth/callback`
4. Copy **Project URL** and **anon public** key.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key  
- Optional: `GAME_CODE` = a secret code; when set, only users who enter this code can sign up (share with family/friends).  
- Optional: `NEXT_PUBLIC_THEME_MUSIC_URL` = URL to a royalty-free MP3 (e.g. [Pixabay Music](https://pixabay.com/music/search/tribal/))

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Add the same env vars in Vercel (Project → Settings → Environment Variables).
3. Redeploy. Update Supabase redirect URLs to include your production URL.

## After each episode

Update the database with who was voted out and (at season end) the winner:

1. In Supabase **SQL Editor**, set the voted-out player for the episode:

```sql
update public.episodes
set voted_out_player_id = 'player-id-from-data-players', updated_at = now()
where season = 50 and episode_number = 1;
```

2. To add the next episode (and set lock time), run:

```sql
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 2, '2026-03-04 19:00:00-05');
```

Use player IDs from `src/data/players.ts` (e.g. `jenna-lewis-dougherty`, `dee-valladares`).

## Theme music

The app includes a floating music toggle. By default it uses an optional env URL. For royalty-free tribal/adventure music, use [Pixabay Music](https://pixabay.com/music/search/tribal/) or similar; download an MP3 and host it, or use a direct link if the license allows.

## Single source of truth

See **`docs/SSOT.md`** for point system, decisions, and TODOs.
