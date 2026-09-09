import type { SeasonDashboard } from "../../lib/season-dashboard";
import { profileIcon } from "../profile-icons";
import { EpisodeSpotlight } from "./spotlight";

const points = (value: number) => `${value} ${value === 1 ? "point" : "points"}`;
const movement = (value: number | null) => value === null ? "First scored episode" : value === 0 ? "Rank unchanged" : `${value > 0 ? "Up" : "Down"} ${Math.abs(value)} ${Math.abs(value) === 1 ? "place" : "places"}`;

export function SeasonView({ data }: { data: SeasonDashboard }) {
  const latest = data.history[0];
  return <>
    <div className="season-stats" aria-label="Your season at a glance">
      <div><span>Season total</span><strong>{data.totalPoints}<small>PTS</small></strong><p>{data.playerName}</p></div>
      <div><span>Overall rank</span><strong>{data.overallRank ? `#${data.overallRank}` : "—"}</strong><p>{latest ? movement(latest.movement) : "Everyone starts together"}</p></div>
      <div><span>Latest episode</span><strong>{latest ? `+${latest.points}` : "—"}</strong><p>{latest ? `Episode ${latest.episodeId} · round rank #${latest.roundRank}` : "Your first score is ahead"}</p></div>
    </div>
    <nav className="season-jump-links" aria-label="Season sections">
      <a href="#score-history">My scorecard</a><a href="#season-standings">Leaderboard</a>
    </nav>
    <div className="season-layout">
      <section id="score-history" aria-labelledby="score-history-title">
        <div className="season-heading"><p className="eyebrow">Every pick. Every point.</p><h2 id="score-history-title">Your season scorecard</h2><p>Open an episode to see exactly how your score adds up. Results appear after 9:00 AM ET the following morning.</p></div>
        {!latest ? <div className="season-empty"><span aria-hidden="true">◈</span><h3>Your story starts with a pick.</h3><p>Your published episode scores will collect here. Save your opening picks and come back after the first results reveal.</p><a className="button button-primary" href="/play">Make my picks →</a></div> :
          <div className="episode-ledger">{data.history.map((episode, index) => <details className="episode-card" key={episode.episodeId} open={index === 0}>
            <summary><span><small>EPISODE {episode.episodeId}</small><strong>{episode.title}</strong></span><span className="episode-points">+{episode.points}<small>POINTS</small></span><span className="episode-toggle" aria-hidden="true">⌄</span></summary>
            <div className="episode-detail">
              <div className="episode-ranks"><span>Round <strong>#{episode.roundRank}</strong></span><span>Overall <strong>#{episode.overallRank}</strong></span><span>{movement(episode.movement)}</span></div>
              {!episode.hasPick && <p className="episode-note">No weekly picks were on file. Any season-pick awards are listed below.</p>}
              {episode.carriedFromEpisodeId && <p className="episode-note">Eligible picks carried forward from Episode {episode.carriedFromEpisodeId}.</p>}
              {episode.immunityVoid && <p className="episode-note">Immunity was void this episode. It earned no points and preserved your existing streak.</p>}
              <table className="point-ledger"><caption className="season-sr-only">Episode {episode.episodeId} point breakdown</caption><thead><tr><th scope="col">Pick or bonus</th><th scope="col">Points</th></tr></thead><tbody>{episode.rows.map(row => <tr key={row.label}><th scope="row"><strong>{row.label}</strong><span>{row.selection}</span></th><td className={row.points > 0 ? "earned" : ""}>{row.points > 0 ? "+" : ""}{row.points}</td></tr>)}</tbody><tfoot><tr><th scope="row">Episode total</th><td>+{episode.points}</td></tr></tfoot></table>
              <p className="episode-question"><strong>Wild Card question:</strong> {episode.bonusQuestion}</p>
              <div className="episode-running"><span>Season total after this episode</span><strong>{points(episode.totalPoints)}</strong></div>
            </div>
          </details>)}</div>}
      </section>
      <aside className="season-boards">
        <section id="season-standings" className="season-board" aria-labelledby="overall-title"><p className="eyebrow">The full season</p><h2 id="overall-title">Leaderboard</h2>{data.overallRank ? <Standings rows={data.overall}/> : <p>Standings begin when the first episode’s results are published.</p>}<p className="board-footnote">One season total: weekly points, bonuses, Opening Outlast, and Final Torch awards.</p></section>
      </aside>
    </div>
    <EpisodeSpotlight spotlight={data.spotlight}/>
  </>;
}

function Standings({ rows }: { rows: SeasonDashboard["overall"] }) {
  return <ol className="season-standing-list">{rows.map((row, index) => <li className={row.isYou ? "your-standing" : ""} key={index}><span className="standing-rank">#{row.rank}</span><span className="standing-icon" aria-hidden="true">{profileIcon(row.avatarKey).symbol}</span><span className="standing-name">{row.name}{row.isYou && <small>YOU</small>}</span><strong>{row.points}<small>PTS</small></strong></li>)}</ol>;
}
