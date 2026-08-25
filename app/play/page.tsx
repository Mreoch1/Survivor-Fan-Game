import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AppShell } from "../components/AppShell";
import { PlayClient } from "./play-client";
import { createAdminClient } from "../../lib/supabase/admin";
export const metadata: Metadata = { title: "Play" };
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const user = await requireChatGPTUser("/play");
  const { data: profile } = await createAdminClient().from("profiles").select("display_name").eq("id", user.userId).maybeSingle();
  return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Episode 1 · Opening picks</p><h1>Make your move.</h1><p>Signed in as {profile?.display_name || user.displayName}. Picks save to your account and remain editable until the deadline.</p></header><PlayClient /></main></AppShell>;
}
