import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AppShell } from "../components/AppShell";
import { MessagesClient } from "./messages-client";

export const metadata: Metadata = { title: "Private Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  await requireChatGPTUser("/messages");
  return <AppShell><main className="wrap interior-page message-page"><header className="page-hero message-hero"><p className="eyebrow">Private Messages · Whisper Network</p><h1>Talk away from Tribal.</h1><p>Send a private note to another league member. Only you and that person can see the conversation.</p></header><MessagesClient /></main></AppShell>;
}
