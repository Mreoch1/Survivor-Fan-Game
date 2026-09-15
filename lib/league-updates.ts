export type LeagueUpdate = {
  id: string;
  publishedAt: string;
  title: string;
  sections: { title: string; body: string }[];
};

// Append a new, immutable notice for meaningful player-facing changes.
// Never change an old ID to make people acknowledge the same notice again.
export const leagueUpdates: LeagueUpdate[] = [{
  id: "2026-09-15-first-season",
  publishedAt: "2026-09-15T15:00:00Z",
  title: "Welcome to our first season!",
  sections: [
    { title: "1. Make and save your picks", body: "On Play, choose your Weekly Favorite, Immunity winner, and Vote-Out Pick. Before Episode 1, also choose your Opening Outlast: a castaway you think will reach the individual game. Press Save all weekly picks and look for the saved confirmation. Picks close one hour before each episode." },
    { title: "2. One optional prediction", body: "Play Your Advantage is a question about that week's episode. A correct answer earns 1 point. A wrong answer loses 1 point. You can skip it for 0 points. Choose again each week; this answer does not carry forward." },
    { title: "3. Follow your score", body: "My Season shows your points and how you earned them. One total counts for the whole season. New episode scores appear after 9 a.m. Eastern the following morning so we don't spoil the show." },
    { title: "4. Talk with the tribe", body: "Campfire is for group conversations, replies, and ideas. Use the up or down buttons to vote on an idea. An idea becomes a rule only when Mike adds it to Rules. Messages is for private, one-to-one conversations. Look for the small unread badges beside Campfire and Messages." },
    { title: "5. Find Outlast easily", body: "Use Save to my phone at the top of the page to put an Outlast 51 icon on your Home Screen. Choose Keep me signed in on your own phone. You can reopen these notes anytime using What's new. Keep sharing feedback—you're helping make our first year more fun!" },
  ],
}];

export function publishedUpdates(now = Date.now()): LeagueUpdate[] {
  return leagueUpdates.filter(update => Date.parse(update.publishedAt) <= now);
}

export function pendingUpdates(acknowledged: string[], now = Date.now()): LeagueUpdate[] {
  const seen = new Set(acknowledged);
  return publishedUpdates(now).filter(update => !seen.has(update.id));
}

export function validAcknowledgementIds(value: unknown, now = Date.now()): value is string[] {
  if (!Array.isArray(value) || !value.length || value.length > leagueUpdates.length) return false;
  const published = new Set(publishedUpdates(now).map(update => update.id));
  return new Set(value).size === value.length && value.every(id => typeof id === "string" && published.has(id));
}
