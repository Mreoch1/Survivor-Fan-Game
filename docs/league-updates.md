# Player updates and phone access

`lib/league-updates.ts` is the published notice history. Add a new ID and UTC publication date for a meaningful change players need to know. Keep previously published notices immutable. Routine fixes do not need another mandatory notice. Multiple unseen notices appear together in publication order.

Signed-in players see unseen notices on their next page visit or when returning to an open tab. **Got it — continue** records only the displayed IDs for the verified account, then leaves the current page in place. Acknowledging confirms a button press; it cannot prove the player read or understood the notice. History remains at `/updates`.

The commissioner page shows confirmations for the latest published notice. Tracking includes accounts that still need to join, and is restricted to verified commissioner accounts. A read failure shows a retry message without blocking picks; a failed confirmation remains open for retry.

Apply the reviewed `league_update_acknowledgements` migration before the Git-connected application release. The table uses a composite primary key and original server timestamp, with no direct anonymous or player access. Only the server can select or insert receipts; duplicate submissions do not overwrite the first timestamp. The application never creates or migrates tables at startup.

`/save` contains phone and computer instructions. The manifest and original Outlast icons provide the Home Screen identity. The shortcut opens `/play`; existing sign-in and league membership rules still apply. It requires an internet connection and does not cache private picks offline.

Run `npm run verify`, `npm run test:smoke`, and `npm audit --omit=dev`. For browser verification with isolated fake accounts:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4357 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon npm run build
node --import tsx scripts/auth-community-smoke.ts --serve
```

Open `http://127.0.0.1:4357/sign-in` for the commissioner fixture or add `?player=b` for another player. Writes stay in memory. Check the modal at narrow and short viewport sizes, keyboard scrolling, failed-confirmation retry, return visits, history, commissioner access, and `/save`. Use a phone to verify its native Home Screen installation steps.
