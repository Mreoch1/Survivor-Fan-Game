import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AppShell } from "../components/AppShell";
import { PlayClient } from "./play-client";
import { createAdminClient } from "../../lib/supabase/admin";
import "./picks.css";

export const metadata: Metadata = { title: "Make Picks" };
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const user = await requireChatGPTUser("/play");
  const { data: profile } = await createAdminClient().from("profiles").select("display_name").eq("id", user.userId).maybeSingle();
  return <AppShell><main className="wrap interior-page pick-page"><header className="pick-page-intro"><div><p className="eyebrow">Private voting booth</p><h1>Make your picks</h1></div><p>Signed in as <strong>{profile?.display_name || user.displayName}</strong></p></header><PlayClient /></main></AppShell>;
}
