import type { Metadata } from "next";
import { AppShell } from "../components/AppShell";
import { requireChatGPTUser } from "../chatgpt-auth";
import { loadSeasonDashboard } from "../../db/season";
import { SeasonView } from "./season-view";
import "./season.css";

export const metadata: Metadata = { title: "My Season" };
export const dynamic = "force-dynamic";

export default async function SeasonPage() {
  const user = await requireChatGPTUser("/season");
  const data = await loadSeasonDashboard(user.userId);
  return <AppShell><main className="wrap interior-page season-page"><header className="page-hero season-hero"><p className="eyebrow">Your Outlast journey</p><h1>Every point tells a story.</h1><p>Your picks, your progress, and another chance to climb when the individual game begins.</p><a href="/play" className="button button-primary">Make this week’s picks →</a></header>{data ? <SeasonView data={data}/> : <div className="season-empty"><h2>Join the tribe to start your season.</h2><p>Use Mike’s invite code to join the league. Your scorecard will be waiting here.</p><a href="/play" className="button button-primary">Join the league →</a></div>}</main></AppShell>;
}
