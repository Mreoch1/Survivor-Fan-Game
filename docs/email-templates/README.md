# Themed auth email templates

Survivor Fan Game styling for Supabase Auth emails (dark green, gold CTA). You can set them via **CLI** or **Dashboard**.

## Option A: CLI (recommended)

1. Get a personal access token: [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens). Create a token with access to your project.
2. Add to `.env.local`:
   ```
   SUPABASE_ACCESS_TOKEN=your-token-here
   ```
   (Project ref is read from `NEXT_PUBLIC_SUPABASE_URL` if present.)
3. Run:
   ```bash
   npm run email-templates
   ```
   Or: `node scripts/setup-email-templates.mjs` (script loads `.env.local` automatically).

## Option B: Dashboard (manual)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Email Templates**.
3. For each template type, set **Subject** (see table) and paste the full HTML from the matching file into the message/body field. Do not change `{{ .ConfirmationURL }}` or other variables.

## Template files

| Supabase template | File | Subject line |
|-------------------|------|--------------|
| Confirm signup | `confirm-signup.html` | Confirm your spot on the island |
| Reset password | `reset-password.html` | Reset your torch |
| Invite user | `invite.html` | You're invited to Survivor Fan Game |
| Magic link | `magic-link.html` | Your link to the island |

## Notes

- Variables like `{{ .ConfirmationURL }}` and `{{ .SiteURL }}` are replaced by Supabase. Leave them as-is.
- If you use custom SMTP, the same HTML works; configure templates in your provider or keep using Supabase’s template editor.
