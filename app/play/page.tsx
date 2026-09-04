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
  return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Private voting booth</p><h1>Make your move.</h1><p>Signed in as {profile?.display_name || user.displayName}. Each pick is labeled below with the castaway, tribe, or answer currently saved to your account.</p></header><PlayClient /></main></AppShell>;
}
