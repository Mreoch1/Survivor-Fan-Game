# Weekly Tree Mail

The existing `survivor-51-weekly-results-recap` automation now owns one weekly Tree Mail per recipient. It runs Monday at 10 AM America/Detroit, with a Monday 4 PM retry for unsent recipients. The first preseason edition is September 21, 2026; the first score edition is September 28 if the verified premiere remains September 23.

## Data and delivery

Run `node scripts/auto-recap.mjs` from the original project directory with its existing automation secret. The authenticated endpoint is read-only, uses no-store responses, and opens only on Monday at/after 10 AM Detroit time. It returns:

- `pending:false`: no mailing. `needsAttention:true` indicates missing schedule/results needing attention.
- `pending:true`, `kind:preseason`: verified joined recipients and preseason scoring text.
- `pending:true`, `kind:scores`: one report covering all episodes aired during the prior Monday-Sunday, after every episode has published and passed its reveal time. A week without an aired episode is a no-op.

All score totals and ranks use the same published ledger and calculations as My Season. The response whitelists fantasy totals and ranks. It excludes castaway outcomes, names of selections, category scores, episode titles, and narrative highlights. The website's existing release timing is unchanged. No schema change or result mutation is part of this feature.

## Editorial and spoiler policy

Before every new edition, research current CBS/Paramount schedule announcements and safe cast biographical material. Verify facts against the original sources and date the research. Official previews may reveal events: official publication does not make an item safe. Exclude episode plots, twists, votes, departures, challenge winners, idols/advantages, alliances, tribe changes, merge status, exit interviews, leaks, winner predictions based on leaks, and hints about survival. Avoid source links with spoiler-bearing titles, thumbnails, sidebars, or recommended stories. Never search results/recaps for this mailing. Scores come from the endpoint only.

Write roughly 250-400 words in an energetic Jeff Probst-style host narrative: short challenge-like sentences, camp/torch/tribal language, suspense, and friendly encouragement. Keep the Outlast fan identity clear; do not imply Jeff wrote or endorsed the message. Vary the opening. No fabricated quotes or episode events.

Use one common editorial block per edition: a brief Tree Mail opening, one or two verified safe news/schedule items, and a closing invitation to participate. Before the premiere, add 1-3 castaways with verified background, a brief watch angle labeled as analysis, and one open question. Once episodes begin, use general engagement without spotlight choices that hint at who remains. Append each recipient's `emailContent.plainText` unchanged. Its exact score section must not be rewritten or recalculated. Use the endpoint subject, adding only the edition's Monday date if needed. Never put scores or outcomes in subjects or preview snippets.

Send individually through Outlook to the exact returned recipient addresses, honoring any recorded opt-out. No CC or BCC. The Outlook connector currently accepts plain text; use the composed plain-text message. Do not pass HTML to a plain-text field. Do not add a manual signature block.

Use the automation's existing `memory.md` as the delivery ledger. Deduplicate on season + edition ID + normalized recipient email; also preserve and consult prior episode-recipient entries. Record the exact composed issue and its sources before sending. Before every send, record pending intent, exact subject/body and recipient. After confirmed delivery, immediately record timestamp and message evidence. If delivery is ambiguous, reconcile Sent Items before retrying; never resend blindly. The afternoon run retries only unsent recipients for the same edition. Reuse that morning's researched issue after checking for material corrections. If all recipients were sent, stop without another issue or notification. Do not backfill old weeks or send after the season's final score edition.

## Preseason editorial seed — researched September 15, 2026

Recheck every fact and the premiere schedule immediately before sending. This is an editorial seed, not a sent message.

**Tree Mail · The first torch is yours to light**

Come on in, Outlast crew. Twenty-one castaways. A beach full of possibilities. And a fantasy league waiting for its first bold call. Before the first challenge, give yourself an advantage: get to know a few of the people you'll be watching.

CBS has scheduled the two-hour premiere for Wednesday, September 23, at 8 PM Eastern. Circle the night, claim your couch, and bring your best reads.

**Jenna Doore — the room reader**
Jenna is a 30-year-old wedding photographer from Toledo, Ohio. In her preseason questionnaire, she described adding a Survivor clause to her wedding contracts. Our watch angle: managing a wedding could translate into reading people and staying composed. Can she build trust as quickly as she finds the right shot?

**Mike Pinsky — the talent evaluator**
Mike is a 32-year-old New York baseball executive who says he evaluates players for the Yankees and values information in an alliance. Our watch angle: he knows how to assess talent; now he has to compete alongside it. Can he gather information without making everyone notice the scout?

**Sharonda Cox — the calm under pressure**
Sharonda is a 34-year-old OB-GYN resident living in Richmond, Kentucky. Her preseason answers emphasize loyalty and adaptability. Our watch angle: clear thinking and flexibility could matter at camp. Can she be dependable while staying ready to change direction?

These are preseason observations, with no knowledge of outcomes. Choose your reads, back your instincts, and keep that torch lit. Your first Monday score check comes after premiere week, giving everyone the weekend to watch.

### Research sources

- [CBS/Paramount official cast and premiere announcement, August 26](https://www.paramountpressexpress.com/cbs-entertainment/shows/survivor/releases/?view=113157-survivor-reveals-the-21-new-castaways-competing-on-the-51st-edition-the-first-in-the-series-new-open-era-with-a-two-hour-season-premiere-on-wednesday): names, ages, occupations, residences, cast count, premiere timing.
- [Parade preseason cast questionnaires, updated September 12](https://parade.com/tv/survivor-51-cast-2026): Jenna's contract detail, Mike's baseball work and information preference, Sharonda's alliance preferences. The page includes unrelated recommendations with past-season spoilers; use these verified biographical facts without linking recipients to that page.

The three profiles together paraphrase fewer than 200 words from the Parade source. The watch angles are editorial inference, not reported game performance. Verify castaway identity by name, not the repository's legacy ID aliases.

## Verification

`npm run verify`, `npm run test:smoke`, and the production dependency audit are required. The recap route test exercises authenticated query handling, read-only behavior, scorecard reconciliation, no-store headers, preseason recipients, hidden results, and stripping spoiler fields. Date tests cover Monday timing, Detroit daylight-saving time, multiple episodes, and off weeks.
