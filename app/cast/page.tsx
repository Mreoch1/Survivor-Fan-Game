import type { Metadata } from "next";
import Image from "next/image";
import { AppShell } from "../components/AppShell";
import { castaways } from "../data";

export const metadata: Metadata = { title: "Official Season 51 Cast" };

export default function CastPage() {
  return <AppShell><main className="wrap interior-page"><header className="page-hero cast-reveal-hero"><p className="eyebrow">Official Season 51 cast</p><h1>The Open Era begins.</h1><p>Twenty-one first-time players enter a shape-shifting game where twists, idols, and advantages from any era can return without warning.</p></header>
    <div className="notice"><strong>Cast confirmed August 26</strong><span>21 new players · two starting tribes · premiere Wednesday, September 23 at 8:00 PM ET</span></div>
    <section className="open-era-note" aria-label="Season 51 theme"><span aria-hidden="true">🐋</span><div><p className="eyebrow">Season theme</p><h2>Welcome to the Open Era</h2><p>The new whale-and-bone visual world signals a less predictable game. Savu and Toka are the expected starting tribes, but individual tribe assignments have not been published by CBS, so this page will not guess.</p></div></section>
    <div className="cast-grid">{castaways.map((castaway, index) => <article className="cast-card official-cast" key={castaway.id}><div className="portrait"><Image src={castaway.image} alt={`Official Season 51 portrait of ${castaway.name}`} fill sizes="(max-width: 800px) 50vw, 33vw"/><i>#{String(index + 1).padStart(2, "0")}</i></div><div className="cast-copy"><div><span className="tribe-dot"/> Official cast · Tribe TBA</div><h2>{castaway.name}</h2><p className="stats">{castaway.age} · {castaway.job}<br/>{castaway.hometown}</p><p>{castaway.bio}</p></div></article>)}</div>
    <p className="image-credit">Official Season 51 photography by Robert Voets/CBS, presented in <a href="https://www.thewrap.com/media-platforms/tv/survivor-season-51-cast-meet-the-castaways/" target="_blank" rel="noreferrer">TheWrap’s cast reveal</a>. Cast details confirmed through <a href="https://www.paramountpressexpress.com/cbs-entertainment/shows/survivor/releases/?view=113151-survivor-to-reveal-the-season-51-castaways-on-youtube-livestream" target="_blank" rel="noreferrer">Paramount Press Express</a> and CBS reveal coverage. All photos remain © CBS.</p>
  </main></AppShell>;
}
