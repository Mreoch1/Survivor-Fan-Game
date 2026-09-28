import type { Metadata } from "next";
import { AppShell } from "../components/AppShell";
import { CastGrid } from "./cast-grid";
import { loadCastDepartures } from "../../db/cast-status";
import type { CastDeparture } from "../../lib/cast-status";
import "./cast.css";

export const metadata: Metadata = { title: "Official Season 51 Cast" };
export const dynamic = "force-dynamic";

export default async function CastPage() {
  let departures: Map<string, CastDeparture> | null = null;
  try {
    departures = await loadCastDepartures();
  } catch {
    console.error("Cast departure statuses could not be loaded");
  }
  return <AppShell><main className="wrap interior-page cast-status-page"><header className="page-hero cast-reveal-hero"><p className="eyebrow">Official Season 51 cast</p><h1>The Open Era begins.</h1><p>Twenty-one first-time players enter a shape-shifting game where twists, idols, and advantages from any era can return without warning.</p></header>
    <div className="notice"><strong>Cast confirmed August 26</strong><span>21 new players · two starting tribes · premiere Wednesday, September 23 at 8:00 PM ET</span></div>
    {departures ? <div className="notice cast-status-guidance"><strong>A red X means this player has left the game.</strong><span>They cannot be picked. Statuses appear after the spoiler-safe results reveal.</span></div> : <div className="notice cast-status-guidance" role="status"><strong>Player status is temporarily unavailable.</strong><span>Cards are shown without departure markers. <a href="/play">Make Picks</a> shows the eligible choices.</span></div>}
    <section className="open-era-note" aria-label="Season 51 theme"><span aria-hidden="true">🐋</span><div><p className="eyebrow">Season theme</p><h2>Welcome to the Open Era</h2><p>The new whale-and-bone visual world signals a less predictable game. Savu and Toka are the expected starting tribes, but individual tribe assignments have not been published by CBS, so this page will not guess.</p></div></section>
    <CastGrid departures={departures}/>
    <p className="image-credit">Official Season 51 photography by Robert Voets/CBS, presented in <a href="https://www.thewrap.com/media-platforms/tv/survivor-season-51-cast-meet-the-castaways/" target="_blank" rel="noreferrer">TheWrap’s cast reveal</a>. Cast details confirmed through <a href="https://www.paramountpressexpress.com/cbs-entertainment/shows/survivor/releases/?view=113151-survivor-to-reveal-the-season-51-castaways-on-youtube-livestream" target="_blank" rel="noreferrer">Paramount Press Express</a> and CBS reveal coverage. All photos remain © CBS.</p>
  </main></AppShell>;
}
