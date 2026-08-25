import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AppShell } from "../components/AppShell";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Player Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireChatGPTUser("/profile");
  return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Your player identity</p><h1>Raise your flag.</h1><p>Update the name your league sees, give your squad a team name, and choose an island icon for the leaderboard and campfire.</p></header><ProfileClient /></main></AppShell>;
}
