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
- Episode results remain private until 6:30 AM America/Detroit on the Monday following the air date, including across daylight saving time changes. Results automation runs at that time; scores and eliminated-player markers remain gated until then. Already published episodes retain their historical reveal time.
- Vercel Cron provides a weekly publish safety net during the fall season.
- Commissioner, result-intake, and reminder routes require `AUTO_RESULTS_SECRET`.

## Season scorecards

- `/season` requires a signed-in, joined league member. It serves only published results whose spoiler reveal time has passed.
- Episode point breakdowns reuse the recap email helper. Historical ranks include members who had joined by that episode’s lock time.
- One cumulative leaderboard runs from the first episode through the finale. Weekly points and bonuses plus Opening Outlast and Final Torch awards add to the same season total; ties share ranks and the season title.
- Campfire highlights are derived from published scores, without creating posts or sending additional notifications.
- Weekly Favorite, Immunity, and Vote-Out Picks are required. Play Your Advantage is optional: +1 correct, -1 wrong, or 0 when skipped. Play Your Advantage answers never carry forward, and Shot in the Dark doubles only a correct reward.
- Season reads paginate the ledger and do not require a database migration.

For each new episode, choose a precise Play Your Advantage question from official previews, with two to four mutually exclusive choices covering all outcomes. Start every new custom question with “During Episode N,” using the exact episode number. State the exact qualifying event and every eligible idol or advantage. The shared fallback may retain “this episode” because the pick form explicitly labels the episode scope. Explicitly include or exclude Shot in the Dark for advantage questions. Finding, receiving, revealing, attempting, playing, and succeeding are distinct events. Define success (for example, blocking at least one vote), and say whether a valid play with no effect counts. The aired episode must support exactly one answer. Keep all scoring conditions in the displayed question within 140 characters; simplify its scope if necessary. Clarity takes priority over having a different question every week. Leaks and unaired outcomes remain excluded. If an answer remains ambiguous, automation stops for commissioner review. When entering unscored results, the commissioner can explicitly void the question; all answers and any Shot in the Dark targeting it score zero. Missing answers never implicitly void a question, and already scored episodes cannot be overwritten through this control.

When no suitable precise preview question can be verified, use the exact shared `DEFAULT_ADVANTAGE_QUESTION` with Yes/No: “Will a valid immunity idol be played at Tribal Council this episode (even if it blocks no votes)? Finds and Shot in the Dark do not count.” Preserve already scheduled questions and choices, including the current episode; these standards apply to new future episodes. The server still freezes scoring fields after picks exist. The automation context returns the shared checklist and default; the saved AI commissioner prompt should follow those supplied values instead of hardcoding an older fallback.

Team names are unique across profiles, ignoring capitalization and extra whitespace. Blank names remain optional. Both joining and Profile editing return a clear conflict message; the database unique index also protects concurrent saves.
