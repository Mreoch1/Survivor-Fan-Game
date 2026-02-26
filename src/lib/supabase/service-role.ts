import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-only Supabase client with service role key. Bypasses RLS.
 * Use for cron and for process-episode (updates all users’ picks/points).
 * Set SUPABASE_SERVICE_ROLE_KEY in Vercel (Supabase Dashboard → Settings → API).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for service role client");
  }
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
