import type { Metadata } from "next";
import { AppShell } from "../components/AppShell";
import { castaways } from "../data";
export const metadata: Metadata = { title: "Cast" };

export default function CastPage() {
  return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Meet the players</p><h1>Choose your favorite.</h1><p>Season 51’s names have not yet been officially announced. These rumored profiles are clearly marked and will be replaced when CBS releases the cast.</p></header>
    <div className="notice"><strong>Preseason watchlist</strong><span>21 rumored first-time players · details may change before premiere</span></div>
    <div className="cast-grid">{castaways.map((c, i) => <article className={`cast-card ${c.tribe.toLowerCase()}`} key={c.id}><div className="portrait"><img src={c.image} alt={`Preseason portrait of ${c.name}`}/><i>#{String(i+1).padStart(2,"0")}</i></div><div className="cast-copy"><div><span className="tribe-dot"/> {c.tribe} · Rumored</div><h2>{c.name}</h2><p className="stats">{c.age} · {c.job}<br/>{c.hometown}</p><p>{c.bio}</p></div></article>)}</div>
    <p className="image-credit">Preseason portraits sourced from <a href="https://insidesurvivor.com/cast/rumored-survivor-51-cast" target="_blank" rel="noreferrer">Inside Survivor’s rumored-cast report</a>. Rights remain with their respective owners and subjects. Official CBS portraits will replace these when released.</p>
  </main></AppShell>;
}
