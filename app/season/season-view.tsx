import type { SeasonDashboard } from "../../lib/season-dashboard";
import { profileIcon } from "../profile-icons";
import { EpisodeSpotlight } from "./spotlight";

const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
const points = (value: number) => `${value} ${Math.abs(value) === 1 ? "point" : "points"}`;
const movement = (value: number | null) => value === null ? "First scored episode" : value === 0 ? "Rank unchanged" : `${value > 0 ? "Up" : "Down"} ${Math.abs(value)} ${Math.abs(value) === 1 ? "place" : "places"}`;
const pointClass = (value: number) => value > 0 ? "earned" : value < 0 ? "lost" : "";

type PointLedgerRow = { label: string; points: number; outcome: string; selection?: string };

type PopupLedgerRow = { questionId: string; question: string; revealAt: string; points: number; outcome: string; selection?: string };

function PopupLedger({ rows, total, caption }: { rows: PopupLedgerRow[]; total: number; caption: string }) {
  return <table className="point-ledger popup-ledger">
    <caption className="season-sr-only">{caption}</caption>
    <thead><tr><th scope="col">Popup question</th><th scope="col">Points</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.questionId}>
      <th scope="row"><strong>{row.question}</strong>{row.selection && <span>Your answer: {row.selection}</span>}<span className="point-outcome">{row.outcome}</span><span>Revealed {new Date(row.revealAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Detroit" })}</span></th>
      <td className={pointClass(row.points)}>{signed(row.points)}</td>
    </tr>)}</tbody>
    <tfoot><tr><th scope="row">Popup points</th><td>{signed(total)}</td></tr></tfoot>
  </table>;
}

function PointLedger({ rows, total, caption }: { rows: PointLedgerRow[]; total: number; caption: string }) {
  return <table className="point-ledger">
    <caption className="season-sr-only">{caption}</caption>
    <thead><tr><th scope="col">Pick or bonus</th><th scope="col">Points</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.label}>
      <th scope="row"><strong>{row.label}</strong>{row.selection && row.selection !== row.outcome && <span>{row.selection}</span>}<span className="point-outcome">{row.outcome}</span></th>
      <td className={pointClass(row.points)}>{signed(row.points)}</td>
    </tr>)}</tbody>
    <tfoot><tr><th scope="row">Episode total</th><td>{signed(total)}</td></tr></tfoot>
  </table>;
}

export function SeasonView({ data }: { data: SeasonDashboard }) {
  const latest = data.history[0];
  return <>
    <div className="season-stats" aria-label="Your season at a glance">
      <div><span>Season total</span><strong>{data.totalPoints}<small>PTS</small></strong><p>{data.playerName}</p></div>
      <div><span>Overall rank</span><strong>{data.overallRank ? `#${data.overallRank}` : "—"}</strong><p>{data.overallRank ? movement(data.overallMovement) : "Everyone starts together"}{data.movementLabel !== "Rank change" && <> · {data.movementLabel}</>}</p></div>
      <div><span>Latest episode</span><strong>{latest ? signed(latest.points) : "—"}</strong><p>{latest ? `Episode ${latest.episodeId} · round rank #${latest.roundRank}` : "Your first score is ahead"}</p></div>
    </div>
    <nav className="season-jump-links" aria-label="Season sections">
      <a href="#season-standings">Leaderboard &amp; points</a><a href="#score-history">My picks &amp; scorecard</a><a href="#popup-score-history">My popup points</a>
    </nav>
    <section id="season-standings" className="season-board" aria-labelledby="overall-title">
      <div className="season-board-heading"><div><p className="eyebrow">The full season</p><h2 id="overall-title">Leaderboard</h2></div>{data.latestPublishedEpisodeId !== null && <span className="season-through">Episode {data.latestPublishedEpisodeId}{data.popupHistory.length > 0 ? " + revealed popups" : " results"}</span>}</div>
      {data.overallRank ? <><p>Open any player to see their episode scores and popup points.</p><Standings rows={data.overall}/></> : <p>Standings begin when the first episode’s results are published.</p>}
      <p className="board-footnote">Season totals include episode scores, season awards, and popup points. Popup awards do not change episode scores. Equal scores share a rank. Rank changes compare episode reveals; later popup awards are compared with the latest episode. Only revealed results appear, and each player’s selections stay private.</p>
    </section>
    <section id="score-history" className="season-score-history" aria-labelledby="score-history-title">
      <div className="season-heading"><p className="eyebrow">Your picks. Every point.</p><h2 id="score-history-title">Your season scorecard</h2><p>Your saved selections and scoring outcomes, episode by episode. Results appear the following Monday at 6:30 AM ET.</p></div>
      {!latest ? <div className="season-empty"><span aria-hidden="true">◈</span><h3>Your story starts with a pick.</h3><p>Your published episode scores will collect here. Make this week’s picks and come back after the results reveal.</p><a className="button button-primary" href="/play">Make my picks →</a></div> :
        <div className="episode-ledger">{data.history.map((episode, index) => <details className="episode-card" key={episode.episodeId} open={index === 0}>
          <summary><span><small>EPISODE {episode.episodeId}</small><strong>{episode.title}</strong></span><span className="episode-points">{signed(episode.points)}<small>POINTS</small></span><span className="episode-toggle" aria-hidden="true">⌄</span></summary>
          <div className="episode-detail">
            <div className="episode-ranks"><span>Round <strong>#{episode.roundRank}</strong></span><span>Overall <strong>#{episode.overallRank}</strong></span><span>{movement(episode.movement)}</span></div>
            {!episode.hasPick && <p className="episode-note">No weekly picks were on file. Any season-pick awards are listed below.</p>}
            {episode.carriedFromEpisodeId && <p className="episode-note">Eligible picks carried forward from Episode {episode.carriedFromEpisodeId}.</p>}
            {episode.immunityVoid && <p className="episode-note">Immunity was void this episode. It earned no points and preserved your existing streak.</p>}
            <PointLedger rows={episode.rows} total={episode.points} caption={`Your Episode ${episode.episodeId} point breakdown`}/>
            <p className="episode-question"><strong>Play Your Advantage question:</strong> {episode.bonusQuestion}</p>
            <div className="episode-running"><span>Season total at this reveal</span><strong>{points(episode.totalPoints)}</strong></div>
          </div>
        </details>)}</div>}
    </section>
    <section id="popup-score-history" className="season-score-history" aria-labelledby="popup-history-title">
      <div className="season-heading"><p className="eyebrow">Extra questions. Separate points.</p><h2 id="popup-history-title">Your popup points · {data.popupPoints}</h2><p>Each correct popup answer earns 3 points. A wrong or skipped answer earns 0. These points count toward your season total, separately from episode scores.</p></div>
      {data.popupHistory.length ? <PopupLedger rows={data.popupHistory} total={data.popupPoints} caption="Your popup question point breakdown"/> : <p className="episode-note">No revealed popup results yet. See your open questions and saved answers on the <a href="/popup-questions">Popup questions page</a>.</p>}
    </section>
    <EpisodeSpotlight spotlight={data.spotlight}/>
  </>;
}

function Standings({ rows }: { rows: SeasonDashboard["overall"] }) {
  return <ol className="season-standing-list">{rows.map(row => <li key={row.id}>
    <details className={`standing-card ${row.isYou ? "your-standing" : ""}`}>
      <summary className="standing-summary">
        <span className="standing-rank"><span className="season-sr-only">Rank </span>#{row.rank}</span>
        <span className="standing-player"><span className="standing-icon" aria-hidden="true">{profileIcon(row.avatarKey).symbol}</span><span className="standing-name">{row.name}{row.isYou && <small>YOU</small>}</span></span>
        <span className="standing-total"><strong>{row.points}</strong><small>Season points</small></span>
        <span className="standing-popup"><strong>{row.popupPoints}</strong><small>Popup points</small></span>
        <span className="standing-latest"><strong>{row.latestPoints === null ? "—" : signed(row.latestPoints)}</strong><small>{row.latestEpisodeId === null ? "No scored episode" : `Episode ${row.latestEpisodeId}`}</small></span>
        <span className="standing-movement"><strong>{row.latestPoints === null ? "—" : row.movement === null ? "First round" : row.movement === 0 ? "No change" : `${row.movement > 0 ? "↑" : "↓"} ${Math.abs(row.movement)}`}</strong><small>{row.movementLabel !== "Rank change" ? row.movementLabel : row.movement === null || row.movement === 0 ? "Rank change" : movement(row.movement)}</small></span>
        <span className="standing-toggle" aria-hidden="true">⌄</span>
      </summary>
      <div className="standing-detail">
        <h3>{row.name} · points by episode</h3>
        {row.episodes.length === 0 ? <p className="episode-note">No scored episodes yet. This player joined after the latest published episode’s deadline.</p> : <div className="member-episode-list">{row.episodes.map((episode, index) => <details className="member-episode" key={episode.episodeId} open={index === 0}>
          <summary><span>Episode {episode.episodeId}<small>{episode.title}</small></span><strong>{signed(episode.points)} <small>pts</small></strong><span className="member-episode-toggle" aria-hidden="true">⌄</span></summary>
          <div className="member-episode-detail">
            <div className="episode-ranks"><span>Round <strong>#{episode.roundRank}</strong></span><span>Overall <strong>#{episode.overallRank}</strong></span><span>{movement(episode.movement)}</span></div>
            <PointLedger rows={episode.rows} total={episode.points} caption={`${row.name}, Episode ${episode.episodeId} point breakdown`}/>
            <div className="episode-running"><span>Season total at this reveal</span><strong>{points(episode.totalPoints)}</strong></div>
          </div>
        </details>)}</div>}
        <h3>Popup question points</h3>
        {row.popups.length ? <PopupLedger rows={row.popups} total={row.popupPoints} caption={`${row.name}, popup question point breakdown`}/> : <p className="episode-note">No revealed popup results for this player yet.</p>}
      </div>
    </details>
  </li>)}</ol>;
}
