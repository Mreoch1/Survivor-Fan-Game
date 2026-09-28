export type CastStatusEpisode = { id: number; reveal_at: string; results_published: boolean };
export type CastStatusResult = { episode_id: number; departures: unknown };
export type CastDeparture = { episodeId: number; type: "vote" | "medical" | "quit"; label: "Voted out" | "Left the game" };

// Derive visible status only from revealed results, never from a pending cast-status update.
export function buildCastDepartures({ episodes, results, now, castawayIds }: {
  episodes: CastStatusEpisode[];
  results: CastStatusResult[];
  now: Date;
  castawayIds: string[];
}): Map<string, CastDeparture> {
  const visible = episodes.filter(episode => episode.results_published === true && Date.parse(episode.reveal_at) <= now.getTime()).sort((a, b) => a.id - b.id);
  const resultByEpisode = new Map(results.map(result => [result.episode_id, result]));
  const knownCastaways = new Set(castawayIds);
  const departures = new Map<string, CastDeparture>();
  for (const episode of visible) {
    const result = resultByEpisode.get(episode.id);
    if (!result || !Array.isArray(result.departures)) throw new Error("Published cast departure results are unavailable");
    for (const value of result.departures) {
      if (!value || typeof value !== "object") throw new Error("Published cast departure is invalid");
      const departure = value as { castawayId?: unknown; type?: unknown };
      if (typeof departure.castawayId !== "string" || !knownCastaways.has(departure.castawayId) ||
        (departure.type !== "vote" && departure.type !== "medical" && departure.type !== "quit")) {
        throw new Error("Published cast departure is invalid");
      }
      departures.set(departure.castawayId, { episodeId: episode.id, type: departure.type, label: departure.type === "vote" ? "Voted out" : "Left the game" });
    }
  }
  return departures;
}
