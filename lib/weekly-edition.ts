export type MailEpisode = {
  id: number;
  air_at: string;
  reveal_at: string;
  results_published: boolean;
};

export function detroitDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function mondayMailWindow(now = new Date()) {
  const date = detroitDate(now);
  const calendar = new Date(`${date}T12:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit", hour: "numeric", hourCycle: "h23",
  }).format(now));
  calendar.setUTCDate(calendar.getUTCDate() - 7);
  return {
    date,
    previousMonday: calendar.toISOString().slice(0, 10),
    open: new Date(`${date}T12:00:00Z`).getUTCDay() === 1 && hour >= 10,
  };
}

export function selectWeeklyEdition(episodes: MailEpisode[], now = new Date()) {
  const window = mondayMailWindow(now);
  if (!window.open) return { pending: false as const, message: "Tree Mail opens Mondays at 10 AM America/Detroit" };
  const sorted = [...episodes].sort((a, b) => a.air_at.localeCompare(b.air_at));
  if (!sorted.length) return { pending: false as const, needsAttention: true, message: "Season schedule is unavailable" };
  const premiere = sorted[0];
  if (new Date(premiere.air_at) > now) {
    return { pending: true as const, kind: "preseason" as const, editionId: `s51-preseason-${window.date}`, episodeIds: [] as number[], premiereAt: premiere.air_at };
  }
  const week = sorted.filter(episode => {
    const airDate = detroitDate(new Date(episode.air_at));
    return airDate >= window.previousMonday && airDate < window.date;
  });
  if (!week.length) return { pending: false as const, message: "No episode aired in the preceding week" };
  if (week.some(episode => !episode.results_published || new Date(episode.reveal_at) > now)) {
    return { pending: false as const, needsAttention: true, message: "Waiting for all of the week's published scores" };
  }
  return { pending: true as const, kind: "scores" as const, editionId: `s51-week-${window.date}`, episodeIds: week.map(episode => episode.id), premiereAt: premiere.air_at };
}
