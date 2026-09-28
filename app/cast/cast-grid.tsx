import Image from "next/image";
import { castaways } from "../data";
import type { CastDeparture } from "../../lib/cast-status";

export function CastGrid({ departures }: { departures: Map<string, CastDeparture> | null }) {
  return <div className="cast-grid">{castaways.map((castaway, index) => {
    const departure = departures?.get(castaway.id);
    return <article className={`cast-card official-cast${departure ? " cast-departed" : ""}`} key={castaway.id}>
      <div className="portrait">
        <Image src={castaway.image} alt={`Official Season 51 portrait of ${castaway.name}`} fill sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 33vw"/>
        <i>#{String(index + 1).padStart(2, "0")}</i>
        {departure && <span className="cast-departure-x" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false"><path d="M15 15L85 85M85 15L15 85"/></svg></span>}
      </div>
      {departure && <div className="cast-departure-label"><strong>{departure.label} · Episode {departure.episodeId}</strong><span>Not available for picks</span></div>}
      <div className="cast-copy"><div><span className="tribe-dot"/> Official cast · Tribe TBA</div><h2>{castaway.name}</h2><p className="stats">{castaway.age} · {castaway.job}<br/>{castaway.hometown}</p><p>{castaway.bio}</p></div>
    </article>;
  })}</div>;
}
