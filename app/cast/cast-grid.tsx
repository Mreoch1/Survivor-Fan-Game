import Image from "next/image";
import type { CSSProperties } from "react";
import { castaways, type Castaway } from "../data";
import type { CastDeparture } from "../../lib/cast-status";

type CurrentCastaway = Omit<Castaway, "tribe"> & { tribe: string };
type Tribe = { name: string; hex: string };

export function CastGrid({ departures, cast = castaways, tribes = [] }: { departures: Map<string, CastDeparture> | null; cast?: CurrentCastaway[]; tribes?: Tribe[] }) {
  return <div className="cast-grid">{cast.map(castaway => {
    const departure = departures?.get(castaway.id);
    const color = castaway.tribeHex || tribes.find(tribe => tribe.name === castaway.tribe)?.hex;
    const number = castaways.findIndex(player => player.id === castaway.id) + 1;
    return <article className={`cast-card official-cast ${castaway.tribe.toLowerCase()}${departure ? " cast-departed" : ""}`} key={castaway.id} style={color ? { "--tribe-color": color } as CSSProperties : undefined}>
      <div className="portrait">
        <Image src={castaway.image} alt={`Official Season 51 portrait of ${castaway.name}`} fill sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 33vw"/>
        <i>#{String(number).padStart(2, "0")}</i>
        {departure && <span className="cast-departure-x" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false"><path d="M15 15L85 85M85 15L15 85"/></svg></span>}
      </div>
      {departure && <div className="cast-departure-label"><strong>{departure.label} · Episode {departure.episodeId}</strong><span>Not available for picks</span></div>}
      <div className="cast-copy"><div><span className="tribe-dot" aria-hidden="true"/> Official cast · {castaway.tribe === "Unassigned" ? "Tribe TBA" : castaway.tribe}</div><h3>{castaway.name}</h3><p className="stats">{castaway.age} · {castaway.job}<br/>{castaway.hometown}</p><p>{castaway.bio}</p></div>
    </article>;
  })}</div>;
}
