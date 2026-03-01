# Troubleshooting

## "Cannot connect to the server" when clicking the signup confirmation email

**Symptom:** After signing up, the user receives the confirmation email and clicks the button/link. The browser shows "Cannot connect to the server" (or similar) instead of confirming and logging them in.

**Cause:** Supabase sends the confirmation link. When the user clicks it, Supabase verifies the token and then **redirects the browser to your app**. That redirect URL must be explicitly allowed in your Supabase project. If the **Site URL** or **Redirect URLs** are wrong or missing for your live app, Supabase may redirect to the wrong place (e.g. localhost), and the user’s device cannot open it.

**Fix (do this in Supabase):**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Authentication** → **URL Configuration**.
3. Set **Site URL** to your **production** app URL (no trailing slash), e.g.:
   - `https://survivor-fan-game.vercel.app`
   - Or whatever your Vercel (or other) URL is.
4. Under **Redirect URLs**, add (one per line):
   - `https://survivor-fan-game.vercel.app/auth/callback`
   - `https://survivor-fan-game.vercel.app/**`  
     (allows callback with query params, e.g. invite tokens)
   - For local dev: `http://localhost:3000/auth/callback` and `http://localhost:3000/**`
5. Save.

**Important:** If **Site URL** was set to `http://localhost:3000` (for development), Supabase may redirect confirmations to localhost. On another device or network, that URL does not open, so the user sees "cannot connect." For production, **Site URL** must be the real public URL of the app.

After updating, have the user request a **new** confirmation email (e.g. "Resend" on the signup page or sign up again) and click the new link. Old links may still point to the previous redirect target.

---

## Other auth issues

- **"Invalid redirect URL"** in the app: the URL you’re redirecting to is not in Supabase **Redirect URLs**. Add the exact URL (including `/auth/callback`) to the list.
- **Confirmation link works on one device but not another:** Ensure **Site URL** and **Redirect URLs** use `https://` and the same domain you use in the browser (e.g. your Vercel URL), not localhost.
