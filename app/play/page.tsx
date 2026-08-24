import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AppShell } from "../components/AppShell";
import { PlayClient } from "./play-client";
export const metadata: Metadata = { title: "Play" };
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const user = await requireChatGPTUser("/play");
  return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Episode 1 · Opening picks</p><h1>Make your move.</h1><p>Signed in as {user.displayName}. Picks save to your account and remain editable until the deadline.</p></header><PlayClient /></main></AppShell>;
}
