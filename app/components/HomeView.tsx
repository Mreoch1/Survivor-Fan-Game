import { Countdown } from "./Countdown";
import type { HomeSummary } from "../../db/home";

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) + " ET";
}

export function HomeView({ data, signedIn, now }: { data: HomeSummary | null; signedIn: boolean; now: number }) {
  const episode = data?.episode;
  const locked = Boolean(episode && Date.parse(episode.lockAt) <= now);
  const joined = Boolean(data?.joined);
  const status = !data ? "Pick status unavailable" : !episode ? "Waiting for the next episode" : locked ? "Picks are locked" : data.pickStatus === "saved" ? "Your picks are saved" : data.pickStatus === "carried" ? "Picks carried forward" : data.pickStatus === "incomplete" ? "A few picks need your attention" : "Make this week’s picks";
  const action = !joined ? signedIn ? "Join the league" : "Sign in to make picks" : locked ? "Open Play" : data?.pickStatus === "saved" || data?.pickStatus === "carried" ? "Review my picks" : "Make my picks";
  return <main className="home-page">
    <section className={`wrap home-welcome ${joined ? "home-member" : ""}`}>
      <div>
        <p className="eyebrow">{joined ? `Welcome back, ${data?.displayName}` : "Outlast 51 · Family & friends"}</p>
        <h1>{joined ? "Your week on the island." : <>Outpick. Outlast.<br/><em>Outscore.</em></>}</h1>
        <p className="home-intro">{joined ? "Make your picks, follow the points, and see who’s leading the tribe." : "Three weekly picks. One season of bragging rights. Join our private Survivor fantasy league."}</p>
        <div className="home-actions"><a className="button button-primary" href="/play">{action} →</a><a className="text-link" href={joined ? "/season#season-standings" : "/rules"}>{joined ? "See the leaderboard" : "How to play"}</a></div>
      </div>
      <section className="home-week" aria-label="This week's picks">
        <p className="eyebrow">{episode ? `Episode ${episode.id} · ${episode.title}` : "This week"}</p>
        <h2>{joined || !data ? status : episode ? locked ? "Picks are locked" : "Picks lock in" : "Next episode coming soon"}</h2>
        {episode ? <>
          {!locked && <Countdown target={episode.lockAt} expiredLabel="Picks are now locked"/>}
          <p className="home-deadline">{locked ? "Deadline passed: " : "Deadline: "}<strong>{timeLabel(episode.lockAt)}</strong></p>
          {locked ? <p>Results appear after {timeLabel(episode.revealAt)}.</p> : <p>One hour before the episode airs.</p>}
        </> : <p>{data ? "The next deadline will appear here when the episode is scheduled." : "We couldn’t load the latest status. Open Play to check your picks or try again shortly."}</p>}
        {joined && episode && <div className="home-pick-status">
          <strong>{data?.selectedCount} of {data?.requiredCount} required picks on file</strong>
          {data?.pickStatus === "carried" ? <p>Carried from Episode {data.carriedFromEpisodeId}. Review them for Episode {episode.id}; the optional question starts fresh each week.</p> : data?.pickStatus === "saved" && data.updatedAt ? <p>Saved {timeLabel(data.updatedAt)}. {locked ? "Your selections are final." : "You can edit and save again before the deadline."}</p> : <p>{locked ? "Open your picks to see what was on file at the deadline." : "Open Play to review carried picks and complete anything missing."}</p>}
        </div>}
      </section>
    </section>
    {joined && data && <section className="wrap home-results" aria-label="Published league standings">
      <div><p className="eyebrow">{data.latestScoredEpisode ? `Scores through Episode ${data.latestScoredEpisode}` : "Your season"}</p><h2>Every point, explained.</h2><p className="home-score"><strong>{data.totalPoints}</strong> season points{data.rank != null && <span>Overall rank #{data.rank}</span>}</p><p>Open any player on the leaderboard to see their episode points and how they earned them.</p><a className="button button-primary" href="/season#season-standings">Full leaderboard →</a><a className="home-scorecard-link" href="/season#score-history">My picks and score history</a></div>
      <div className="home-board"><p className="eyebrow">{data.latestScoredEpisode ? "Leading the tribe" : "The league is ready"}</p>{data.standings.map(row => <a className="home-standing" key={row.name} href="/season#season-standings"><span>#{row.rank}</span><strong>{row.name}{row.isYou && <small>YOU</small>}</strong><b>{row.points}<small>PTS</small></b></a>)}{!data.latestScoredEpisode && <p>Standings update after the first episode’s spoiler-safe results release.</p>}</div>
    </section>}
    <section className="wrap home-quickstart" aria-label="How to play">
      <div><p className="eyebrow">Your weekly routine</p><h2>Three picks. Then save.</h2><p>Keep your choices up to date before the deadline.</p></div>
      <ol><li><strong>Pick a favorite</strong><span>Earn 1 point if they are not voted out.</span></li><li><strong>Call immunity</strong><span>Earn 2 points for the winning tribe or castaway.</span></li><li><strong>Predict the vote-out</strong><span>Earn 3 points for the correct castaway.</span></li></ol>
      <p className="home-optional">Play Your Advantage is optional: +1 correct, −1 wrong, or 0 if skipped. <a href="/rules">See all scoring rules →</a></p>
    </section>
  </main>;
}
