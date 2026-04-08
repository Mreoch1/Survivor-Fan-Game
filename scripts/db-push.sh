#!/usr/bin/env bash
# Push migrations via Supabase CLI (linked project). Does not require Node/npm.
# Requires: brew install supabase/tap/supabase, `supabase login`, and `supabase link` in this repo.
# Optional: SUPABASE_DB_PASSWORD if your CLI session needs explicit DB password.
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: brew install supabase/tap/supabase" >&2
  exit 1
fi

if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  exec supabase db push --yes --password "${SUPABASE_DB_PASSWORD}"
fi
exec supabase db push --yes
