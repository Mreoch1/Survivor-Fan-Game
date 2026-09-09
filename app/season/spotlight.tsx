import type { SeasonDashboard } from "../../lib/season-dashboard";
import "./season.css";

export function EpisodeSpotlight({ spotlight }: { spotlight: SeasonDashboard["spotlight"] }) {
  if (!spotlight) return null;
  return <section className="episode-spotlight" aria-label={`Episode ${spotlight.episodeId} league highlights`}>
    <div className="spotlight-heading"><div><p className="eyebrow">Around the campfire · Episode {spotlight.episodeId}</p><h2>{spotlight.title}</h2></div><a href="/campfire" className="text-link">Talk about the episode →</a></div>
    <div className="spotlight-grid">
      <div><span>Episode honors</span><h3>{spotlight.winners.join(" · ") || "A tough week for every camp"}</h3><p>{spotlight.winningPoints > 0 ? `${spotlight.winningPoints} points this round` : spotlight.winningPoints < 0 ? `Highest round score: ${spotlight.winningPoints} point${spotlight.winningPoints === -1 ? "" : "s"}` : "Highest round score: 0 points"}</p></div>
      <div><span>Biggest climb</span><h3>{spotlight.climbers.join(" · ") || "Holding their ground"}</h3><p>{spotlight.placesClimbed ? `Up ${spotlight.placesClimbed} ${spotlight.placesClimbed === 1 ? "place" : "places"} overall` : "No upward rank changes this episode"}</p></div>
      <div><span>Read the vote</span><h3>{spotlight.voteOutReaders.join(" · ") || "The vote kept everyone guessing"}</h3><p>{spotlight.voteOutReaders.length ? "Called a vote-out correctly" : "No correct Vote-Out Picks this round"}</p></div>
    </div>
    <p className="spotlight-prompt">Which pick paid off for you—and who are you backing next week?</p>
  </section>;
}
