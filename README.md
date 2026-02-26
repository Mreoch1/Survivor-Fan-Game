# Survivor Fan Game

Family and friends prediction game for **Survivor Season 50** (2026). Users sign up (including via email invite), pick the season winner, choose a tribe, vote each week for who gets voted out, and earn points for correct predictions.

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

**Pull env from Vercel** (after setting vars in dashboard once):

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

## After each episode (CLI or SQL)

**Option A – Supabase SQL Editor (dashboard):** Run:

```sql
update public.episodes
set voted_out_player_id = 'player-id-from-data-players', updated_at = now()
where season = 50 and episode_number = 1;
```

To add the next episode:

```sql
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 2, '2026-03-04 19:00:00-05');
```

**Option B – CLI:** Save SQL to a file and run with Supabase (e.g. `supabase db execute` if available, or use `psql` with the connection string from `supabase status` for local). For remote, the dashboard SQL Editor is the standard approach.

Use player IDs from `src/data/players.ts` (e.g. `jenna-lewis-dougherty`, `dee-valladares`).

---

## Theme music

Optional: set `NEXT_PUBLIC_THEME_MUSIC_URL` to a royalty-free MP3 (e.g. [Pixabay Music](https://pixabay.com/music/search/tribal/)).

---

## Single source of truth

See **`docs/SSOT.md`** for point system, decisions, and TODOs.
