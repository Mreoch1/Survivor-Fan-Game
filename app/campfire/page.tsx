import type { Metadata } from "next";
import { Suspense } from "react";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AppShell } from "../components/AppShell";
import { CampfireClient } from "./campfire-client";
import { loadSeasonDashboard } from "../../db/season";
import { EpisodeSpotlight } from "../season/spotlight";

export const metadata: Metadata = { title: "Campfire" };
export const dynamic = "force-dynamic";

async function CampfireHighlights({ viewerId }: { viewerId: string }) {
  let data;
  try {
    data = await loadSeasonDashboard(viewerId);
  } catch {
    // A temporarily unavailable scorecard must not block the conversation.
    return <p className="notice">Episode highlights are temporarily unavailable. You can still join the Campfire below.</p>;
  }
  return data ? <EpisodeSpotlight spotlight={data.spotlight}/> : null;
}

export default async function Campfire() {
  const user = await requireChatGPTUser("/campfire");
  return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Private league Tribal Council</p><h1>Bring it to the fire.</h1><p>Start an idea, reply directly underneath it, and vote on the twists you want the league to consider.</p></header><Suspense fallback={null}><CampfireHighlights viewerId={user.userId}/></Suspense><CampfireClient/></main></AppShell>;
}
