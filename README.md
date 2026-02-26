# Survivor Fan Game

Family and friends prediction game for **Survivor Season 50** (2026). Users sign up (including via email invite), pick a player to win, and earn survival points: +1 each week their pick stays in, -1 when voted out (then they pick a new winner). Optional tribe and weekly vote-out picks.

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Supabase** (auth, PostgreSQL)
- **Vercel** (hosting)

## CLI-first setup

All steps use the terminal. Requires [Node.js](https://nodejs.org), [Supabase CLI](https://supabase.com/docs/guides/cli), and [Vercel CLI](https://vercel.com/docs/cli).

### 1. Clone and install

```bash
cd survivor-fan-app
npm install
npm run setup
```

`setup` copies `.env.example` to `.env.local` if missing. Edit `.env.local` with your Supabase URL and key (see below).

### 2. Supabase (CLI)

Create a project at [supabase.com](https://supabase.com). Then from the repo:

**Link (one-time).** Use your project ref from the dashboard URL: `https://supabase.com/dashboard/project/<PROJECT_REF>`.

```bash
supabase link --project-ref YOUR_PROJECT_REF
# Enter your database password when prompted
```

Or with env vars (no prompt):

```bash
export SUPABASE_PROJECT_REF=YOUR_PROJECT_REF
export SUPABASE_DB_PASSWORD=your-database-password
npm run db:link
```

**Push migrations:**

```bash
# If not already linked:
supabase link --project-ref YOUR_PROJECT_REF
# Then push (will prompt for DB password unless you use -p):
supabase db push
# Or with password in env:
SUPABASE_DB_PASSWORD=your-password npm run db:push
```

**Auth redirect URLs:** In Supabase **Authentication → URL Configuration**, add:

- Site URL: `http://localhost:3000` (dev) or your Vercel URL (prod)
- Redirect URLs: `http://localhost:3000/auth/callback`, `https://survivor-fan-game.vercel.app/auth/callback`

### 3. Environment variables

Edit `.env.local` (create from `.env.example` if needed via `npm run setup`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # or anon key from API settings
# Optional for CLI:
# SUPABASE_PROJECT_REF=...   # for npm run db:link
# SUPABASE_DB_PASSWORD=...   # for npm run db:push
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy (Vercel CLI)

**One-time link** (if not already linked via dashboard):

```bash
vercel link
```

**Add env vars via CLI** (run `vercel login` first if needed):

```bash
# From project root, after vercel link:
echo "https://YOUR_PROJECT_REF.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "YOUR_PUBLISHABLE_OR_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Optional: add to preview deployments too
echo "https://YOUR_PROJECT_REF.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "YOUR_PUBLISHABLE_OR_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
```

Then redeploy so the new build picks up the vars: `vercel --prod` or redeploy from the dashboard.

**Pull env from Vercel** (after setting vars in dashboard or CLI once):

```bash
npm run vercel:env:pull
```

**Deploy:**

```bash
npm run deploy
# or preview only:
npm run deploy:preview
```

Or use Vercel CLI directly:

```bash
vercel --prod
```

Add env vars in Vercel via CLI (optional):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## NPM scripts (CLI)

| Script | Command | Description |
|--------|---------|-------------|
| `npm run setup` | - | Copy `.env.example` → `.env.local` if missing |
| `npm run dev` | `next dev` | Start dev server |
| `npm run build` | `next build` | Production build |
| `npm run start` | `next start` | Run production server |
| `npm run lint` | `eslint` | Lint |
| **Supabase** | | |
| `npm run supabase:link` | `supabase link` | Link to remote project (prompts) |
| `npm run db:link` | `supabase link --project-ref $SUPABASE_PROJECT_REF` | Link using env |
| `npm run db:push` | `supabase db push -p $SUPABASE_DB_PASSWORD` | Push migrations |
| `npm run db:diff` | `supabase db diff` | Generate migration from schema changes |
| `npm run db:reset` | `supabase db reset` | Reset local DB (local Supabase only) |
| **Vercel** | | |
| `npm run vercel:link` | `vercel link` | Link directory to Vercel project |
| `npm run vercel:deploy` | `vercel` | Deploy preview |
| `npm run vercel:deploy:prod` | `vercel --prod` | Deploy production |
| `npm run vercel:env:pull` | `vercel env pull` | Pull env vars to `.env.local` |
| `npm run deploy` | `npm run build && vercel --prod` | Build and deploy to production |
| `npm run deploy:preview` | `npm run build && vercel` | Build and deploy preview |

---

## After each episode

**Results publish time:** Friday 9:00 AM ET. Set who was voted out in Supabase; scoring runs automatically at that time (or you can trigger it manually).

### 1. Set who was voted out (before Friday 9 AM)

In Supabase SQL Editor or Table Editor, set `voted_out_player_id` for the episode:

```sql
update public.episodes
set voted_out_player_id = 'player-id-from-data-players', updated_at = now()
where season = 50 and episode_number = 1;
```

Use player IDs from `src/data/players.ts` (e.g. `jenna-lewis-dougherty`, `dee-valladares`).

### 2. Scoring (automated or manual)

- **Automated:** A Vercel Cron job runs **every Friday at 14:00 UTC** (9 AM EST). It processes every Season 50 episode that has `voted_out_player_id` set and is not yet in `episode_points_processed`. No action needed once the cron and env are set (see below).
- **Manual:** While logged in, call the API to process one episode:  
  `POST /api/process-episode` with body `{ "episodeId": "EPISODE_UUID" }`.  
  Get `EPISODE_UUID` from Supabase → episodes.

**Required for automation:** In Vercel project settings, set:

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Settings → API → `service_role` (secret).
- `CRON_SECRET` — Any secret (e.g. `openssl rand -hex 32`). Vercel sends it when invoking the cron so the route can reject unauthorized callers.

### 3. Add the next episode when needed

```sql
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 2, '2026-03-04 19:00:00-05');
```

---

## Theme music

The app ships with a self-hosted track at `public/audio/theme.mp3` (Kevin MacLeod – *Overworld*, [CC BY](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Overworld.mp3)). The in-app music toggle (bottom-right) uses it by default. Override with `NEXT_PUBLIC_THEME_MUSIC_URL` to use a different MP3. Attribution: *Overworld* by Kevin MacLeod (incompetech.com), licensed under CC BY.

## Cast photos

Player cards use [DiceBear Initials](https://www.dicebear.com/styles/initials/) (CC0) when no photo is set. To use real cast photos, set `imageUrl` in `src/data/players.ts` to self-hosted or licensed image URLs (e.g. from [Paramount Press Express](https://www.paramountpressexpress.com/cbs-entertainment/shows/survivor/photos/) with appropriate rights).

---

## Auth email templates (Survivor themed)

Signup and password-reset emails use Survivor Fan Game styling (dark green, gold CTA). **CLI:** add `SUPABASE_ACCESS_TOKEN` to `.env.local` (from [Account → Access Tokens](https://supabase.com/dashboard/account/tokens)), then run `npm run email-templates`. **Manual:** copy HTML from `docs/email-templates/` into Supabase Dashboard → Authentication → Email Templates. See `docs/email-templates/README.md`.

## Single source of truth

See **`docs/SSOT.md`** for point system, decisions, and TODOs.
