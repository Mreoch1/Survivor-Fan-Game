# Outlast 51 Fantasy League

Private family-and-friends Survivor 51 fantasy league hosted on Vercel with Supabase authentication and Postgres persistence.

## Release checks

```bash
npm ci
npm run verify
npm run test:smoke
npm audit --omit=dev
```

Production configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` (Supabase server secret; never expose to the browser)
- `COMMISSIONER_EMAILS`
- `AUTO_RESULTS_SECRET`
- `CRON_SECRET`
- `LEAGUE_INVITE_CODE`
- `NEXT_PUBLIC_SITE_URL`

`/api/health` checks the database and returns `VERCEL_GIT_COMMIT_SHA`, allowing a release to be matched to the exact Git commit.

## Local development

```bash
npm install
vercel env pull .env.local --environment=preview
npm run dev
```

Apply reviewed schema changes from `supabase/migrations/` before deploying application code. Application startup never creates or alters production tables.

## Automation

- Picks lock one hour before the scheduled episode.
- Eligible picks carry to the next episode if a player does not update them.
- The opening Outlast Pick awards 10 points when its castaway reaches Jeff's official individual-game announcement. A one-time Final Torch window then lets players keep that castaway for full winner/finalist points or switch to a remaining castaway for half points.
- Campfire posts support one upvote or downvote per joined player. The application serves and writes votes through authenticated server routes.
- Campfire replies remain nested beneath their main idea, while the main board can be sorted by Tribe Score or newest idea.
- Joined players can send one-to-one private messages through server-validated routes; direct database access remains blocked for browser roles.
- The once-per-season weekly scoring advantage is labeled Shot in the Dark in every player-facing view; the original database field remains unchanged for safe backward compatibility.
- Episode results remain private until 9:00 AM Detroit time the next day.
- Vercel Cron provides a weekly publish safety net during the fall season.
- Commissioner, result-intake, and reminder routes require `AUTO_RESULTS_SECRET`.

## Season scorecards

- `/season` requires a signed-in, joined league member. It serves only published results whose spoiler reveal time has passed.
- Episode point breakdowns reuse the recap email helper. Historical ranks include members who had joined by that episode’s lock time.
- One cumulative leaderboard runs from the first episode through the finale. Weekly points and bonuses plus Opening Outlast and Final Torch awards add to the same season total; ties share ranks and the season title.
- Campfire highlights are derived from published scores, without creating posts or sending additional notifications.
- Wild Card answers carry forward only when the question is unchanged and the previous answer is still available.
- Season reads paginate the ledger and do not require a database migration.
