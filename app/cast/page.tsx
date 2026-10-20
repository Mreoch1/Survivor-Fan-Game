import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { AppShell } from "../components/AppShell";
import { castaways } from "../data";
import { CastGrid } from "./cast-grid";
import { loadCastDepartures } from "../../db/cast-status";
import { loadTribeState } from "../../db/tribes";
import { applyTribeState } from "../../lib/tribes";
import "./cast.css";

export const metadata: Metadata = { title: "Season 51 Cast & Current Tribes" };
export const dynamic = "force-dynamic";

export default async function CastPage() {
  const [departureResult, tribeResult] = await Promise.allSettled([loadCastDepartures(), loadTribeState()]);
  const departures = departureResult.status === "fulfilled" ? departureResult.value : null;
  const tribeState = tribeResult.status === "fulfilled" ? tribeResult.value : null;
  if (!departures) console.error("Cast departure statuses could not be loaded");
  if (!tribeState) console.error("Current tribe assignments could not be loaded");
  const cast = tribeState ? applyTribeState(castaways, tribeState) : castaways.map(castaway => ({ ...castaway, tribe: "Unassigned" }));
  const remaining = cast.filter(castaway => !departures?.has(castaway.id));
  const departed = cast.filter(castaway => departures?.has(castaway.id));
  const groups = tribeState?.phase === "individual"
    ? [{ name: "Individual game", color: "", hex: "#277774", cast: remaining }]
    : [...(tribeState?.tribes || []), ...(!tribeState || remaining.some(castaway => !tribeState.tribes.some(tribe => tribe.name === castaway.tribe)) ? [{ name: "Unassigned", color: "", hex: "#65776d" }] : [])]
      .map(tribe => ({ ...tribe, cast: remaining.filter(castaway => tribe.name === "Unassigned" ? !tribeState?.tribes.some(option => option.name === castaway.tribe) : castaway.tribe === tribe.name) }))
      .filter(tribe => tribe.cast.length > 0);

  return <AppShell><main className="wrap interior-page cast-status-page">
    <header className="page-hero cast-reveal-hero"><p className="eyebrow">Official Season 51 cast</p><h1>Follow every tribe.</h1><p>Track the castaways as tribes change, players leave, and the individual game begins. Updates appear with each episode’s spoiler-safe results reveal.</p></header>
    <div className="notice cast-current-status">
      <strong>{tribeState && tribeState.afterEpisodeId > 0 ? `Tribes verified through Episode ${tribeState.afterEpisodeId}` : tribeState ? "Tribe update awaiting verification" : "Current tribe assignments are temporarily unavailable."}</strong>
      <span>{departures ? `${remaining.length} remaining · ${departed.length} departed` : `${cast.length} castaways · Player status unavailable`}{tribeState && tribeState.phase === "tribe" ? ` · ${tribeState.tribes.length} tribes` : tribeState?.phase === "individual" ? " · Individual game" : ""}</span>
    </div>
    {departures ? <div className="notice cast-status-guidance"><strong>A red X means this player has left the game.</strong><span>They cannot be picked. Statuses appear after the spoiler-safe results reveal.</span></div> : <div className="notice cast-status-guidance" role="status"><strong>Player status is temporarily unavailable.</strong><span>Cards are shown without departure markers. <a href="/play">Make Picks</a> shows the eligible choices.</span></div>}
    <nav className="cast-tribe-summary" aria-label="Cast groups">{groups.map((group, index) => <a href={`#cast-group-${index}`} key={group.name} style={{ "--tribe-color": group.hex } as CSSProperties}><span className="tribe-dot" aria-hidden="true"/><strong>{group.name === "Unassigned" ? "Tribe to be confirmed" : group.name}</strong><span>{group.cast.length} {departures ? "remaining" : "castaways"}</span></a>)}{departed.length > 0 && <a href="#departed-cast"><strong>Left the game</strong><span>{departed.length} castaways</span></a>}</nav>
    {groups.map((group, index) => <section className="cast-tribe-section" id={`cast-group-${index}`} key={group.name} aria-labelledby={`cast-group-heading-${index}`} style={{ "--tribe-color": group.hex } as CSSProperties}>
      <div className="cast-group-heading"><div><p className="eyebrow">{group.color ? group.color : tribeState?.phase === "individual" ? "No more tribes" : "Cast roster"}</p><h2 id={`cast-group-heading-${index}`}>{group.name === "Unassigned" ? "Tribe to be confirmed" : group.name}</h2></div><span>{group.cast.length} {departures ? "remaining" : "castaways"}</span></div>
      <CastGrid cast={group.cast} departures={departures} tribes={tribeState?.tribes}/>
    </section>)}
    {departed.length > 0 && <section className="cast-tribe-section cast-departed-section" id="departed-cast" aria-labelledby="departed-cast-heading"><div className="cast-group-heading"><div><p className="eyebrow">No longer available for picks</p><h2 id="departed-cast-heading">Left the game</h2></div><span>{departed.length} castaways</span></div><CastGrid cast={departed} departures={departures} tribes={tribeState?.tribes}/></section>}
    {Boolean(tribeState?.sources.length) && <p className="image-credit cast-evidence">Tribe assignments verified through Episode {tribeState?.afterEpisodeId}. Sources: {tribeState?.sources.map((source, index) => <span key={source}>{index > 0 ? " · " : ""}<a href={source} target="_blank" rel="noreferrer">Tribe source {index + 1}</a></span>)}</p>}
    <p className="image-credit">Official Season 51 photography by Robert Voets/CBS, presented in <a href="https://www.thewrap.com/media-platforms/tv/survivor-season-51-cast-meet-the-castaways/" target="_blank" rel="noreferrer">TheWrap’s cast reveal</a>. Cast details confirmed through <a href="https://www.paramountpressexpress.com/cbs-entertainment/shows/survivor/releases/?view=113151-survivor-to-reveal-the-season-51-castaways-on-youtube-livestream" target="_blank" rel="noreferrer">Paramount Press Express</a> and CBS reveal coverage. All photos remain © CBS.</p>
  </main></AppShell>;
}
