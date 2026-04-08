#!/usr/bin/env bash
# Run DB migrations without npm (fixes "env: node: No such file or directory" when
# Cursor/SSH terminals do not load nvm/Homebrew into PATH).
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

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Set SUPABASE_DB_PASSWORD (database password from Supabase Dashboard → Settings → Database)." >&2
  exit 1
fi

exec supabase db push --password "${SUPABASE_DB_PASSWORD}"
