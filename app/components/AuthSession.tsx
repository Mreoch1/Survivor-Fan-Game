"use client";

import { useEffect } from "react";
import { createClient } from "../../lib/supabase/client";

export function AuthSession() {
  useEffect(() => {
    // Start the shared browser client's automatic token refresh on every page.
    createClient();
  }, []);
  return null;
}
