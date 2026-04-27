import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLAYERS, TRIBES } from "@/data/players";
import type { TribeId } from "@/data/players";
import { SetDisplayName } from "./SetDisplayName";

const INDIVIDUAL_IMMUNITY_START_EPISODE = 7;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: winnerPick } = await supabase
    .from("winner_picks")
    .select("player_id")
    .eq("user_id", user?.id)
    .eq("season", 50)
    .maybeSingle();
  const { data: pointsRow } = await supabase
    .from("user_season_points")
    .select("points, last_week_delta")
    .eq("user_id", user?.id)
    .eq("season", 50)
    .maybeSingle();
  const { count: episodesProcessed } = await supabase
    .from("episode_points_processed")
    .select("*", { count: "exact", head: true });

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, voted_out_player_id, second_voted_out_player_id, third_voted_out_player_id, medevac_player_id")
    .eq("season", 50)
    .order("episode_number", { ascending: true });

  const currentEpisode = (episodes ?? []).find((e) => !e.voted_out_player_id);
  const isIndividualImmunityPhase = (currentEpisode?.episode_number ?? 0) >= INDIVIDUAL_IMMUNITY_START_EPISODE;

  const episodeResults = (episodes ?? []).map((ep) => ({
    episodeNumber: ep.episode_number,
    bootNames: [ep.voted_out_player_id, ep.second_voted_out_player_id, ep.third_voted_out_player_id]
      .filter(Boolean)
      .map((id) => PLAYERS.find((p) => p.id === id)?.name ?? "Unknown"),
  }));

  const winnerPlayer = winnerPick?.player_id
    ? PLAYERS.find((p) => p.id === winnerPick.player_id)
    : null;
  const userPoints = pointsRow?.points ?? 0;
  const lastWeekDelta = pointsRow?.last_week_delta ?? null;
  const statusThisWeek: "SAFE" | "OUT" | null = winnerPlayer
    ? "SAFE"
    : winnerPick
      ? "OUT"
      : null;

  let userTribeImmunityPick: TribeId | null = null;
  let userIndividualImmunityPickPlayerId: string | null = null;
  let userVoteOutPickPlayerId: string | null = null;
  if (currentEpisode && user?.id) {
    const voteOutPickPromise = supabase
      .from("vote_out_picks")
      .select("player_id")
      .eq("user_id", user?.id)
      .eq("episode_id", currentEpisode.id)
      .maybeSingle();
    const tribeImmunityPickPromise = !isIndividualImmunityPhase
      ? supabase
          .from("tribe_immunity_picks")
          .select("tribe_id")
          .eq("user_id", user?.id)
          .eq("episode_id", currentEpisode.id)
          .maybeSingle()
      : Promise.resolve({ data: null });
    const individualImmunityPickPromise = isIndividualImmunityPhase
      ? supabase
          .from("individual_immunity_picks")
          .select("player_id")
          .eq("user_id", user?.id)
          .eq("episode_id", currentEpisode.id)
          .maybeSingle()
      : Promise.resolve({ data: null });
    const [{ data: voteOutPick }, { data: tribeImmunityPick }, { data: individualImmunityPick }] = await Promise.all([
      voteOutPickPromise,
      tribeImmunityPickPromise,
      individualImmunityPickPromise,
    ]);

    userVoteOutPickPlayerId = voteOutPick?.player_id ?? null;
    userTribeImmunityPick = (tribeImmunityPick?.tribe_id as TribeId) ?? null;
    userIndividualImmunityPickPlayerId = individualImmunityPick?.player_id ?? null;
  }

  const userVoteOutPlayer = userVoteOutPickPlayerId
    ? PLAYERS.find((p) => p.id === userVoteOutPickPlayerId) ?? null
    : null;
  const userIndividualImmunityPlayer = userIndividualImmunityPickPlayerId
    ? PLAYERS.find((p) => p.id === userIndividualImmunityPickPlayerId) ?? null
    : null;

  return (
    <div className="survivor-dashboard">
      <section className="survivor-dashboard__welcome" aria-labelledby="dashboard-welcome">
        <h1 id="dashboard-welcome" className="survivor-dashboard__welcome-title">
          Welcome to the island
        </h1>
        <p className="survivor-dashboard__welcome-subtext">
          You can find your picks, scoring system, and episode updates here.
        </p>
        {(episodesProcessed ?? 0) === 0 && (
          <p className="survivor-dashboard__welcome-subtext">
            Week 1 results pending. Once episode results are in, your points will update.
          </p>
        )}
        {profile && !profile.display_name && <SetDisplayName />}
      </section>

      <section className="survivor-card" aria-labelledby="picks-at-a-glance">
        <h2 id="picks-at-a-glance" className="survivor-card__title">
          Your picks at a glance
        </h2>
        <ul className="survivor-dashboard__list">
          <li className="survivor-dashboard__list-item">
            <strong>Current winner pick:</strong>{" "}
            {winnerPlayer ? (
              <Link href="/dashboard/players" className="survivor-auth__link">
                {winnerPlayer.name}
              </Link>
            ) : (
              <Link href="/dashboard/picks" className="survivor-auth__link">
                {winnerPick
                  ? "Your pick was voted out. Pick again →"
                  : "No pick selected"}
              </Link>
            )}
          </li>
          {!isIndividualImmunityPhase && (
            <li className="survivor-dashboard__list-item">
              <strong>
                Tribe immunity pick:
                {currentEpisode ? ` (Episode ${currentEpisode.episode_number})` : ""}
              </strong>{" "}
              {userTribeImmunityPick ? (
                <span
                  className={`survivor-dashboard__tribe-name--${userTribeImmunityPick}`}
                >
                  {TRIBES[userTribeImmunityPick].name}
                </span>
              ) : (
                <Link href="/dashboard/picks" className="survivor-auth__link">
                  Not picked yet
                </Link>
              )}
            </li>
          )}
          {isIndividualImmunityPhase && (
            <li className="survivor-dashboard__list-item">
              <strong>
                Individual immunity pick:
                {currentEpisode ? ` (Episode ${currentEpisode.episode_number})` : ""}
              </strong>{" "}
              {userIndividualImmunityPlayer ? (
                <Link href="/dashboard/picks" className="survivor-auth__link">
                  {userIndividualImmunityPlayer.name}
                </Link>
              ) : (
                <Link href="/dashboard/picks" className="survivor-auth__link">
                  Not picked yet
                </Link>
              )}
            </li>
          )}
          <li className="survivor-dashboard__list-item">
            <strong>
              Vote-out pick:
              {currentEpisode ? ` (Episode ${currentEpisode.episode_number})` : ""}
            </strong>{" "}
            {userVoteOutPlayer ? (
              <Link href="/dashboard/picks" className="survivor-auth__link">
                {userVoteOutPlayer.name}
              </Link>
            ) : (
              <Link href="/dashboard/picks" className="survivor-auth__link">
                Not picked yet
              </Link>
            )}
          </li>
          <li className="survivor-dashboard__list-item">
            <strong>Status this week:</strong>{" "}
            {statusThisWeek === "SAFE" ? (
              <span className="survivor-dashboard__status-badge survivor-dashboard__status-badge--safe">
                SAFE
              </span>
            ) : statusThisWeek === "OUT" ? (
              <span className="survivor-dashboard__status-badge survivor-dashboard__status-badge--out">
                OUT, REPICK REQUIRED
              </span>
            ) : (
              "—"
            )}
          </li>
          <li className="survivor-dashboard__list-item">
            <strong>Points this week:</strong>{" "}
            {lastWeekDelta != null
              ? lastWeekDelta >= 0
                ? `+${lastWeekDelta}`
                : lastWeekDelta
              : "—"}
          </li>
          <li className="survivor-dashboard__list-item">
            <strong>Total points:</strong>{" "}
            <span className="survivor-dashboard__total-value">{userPoints}</span>
          </li>
        </ul>
        <div className="survivor-dashboard__card-actions">
          <Link href="/dashboard/picks" className="survivor-btn survivor-btn--primary">
            Edit my picks
          </Link>
        </div>
      </section>

      <section className="survivor-card" aria-labelledby="how-scoring-works">
        <h2 id="how-scoring-works" className="survivor-card__title">
          How scoring works
        </h2>
        <ul className="survivor-dashboard__list survivor-dashboard__list--mb">
          <li className="survivor-dashboard__list-item">
            <strong>Winner pick:</strong> Pick one castaway to win the season. Each week they
            survive: +1 point. If they are voted out, injured, or removed: -1 point; then pick a
            new remaining player. Picks lock when the episode starts.
          </li>
          <li className="survivor-dashboard__list-item">
            <strong>Tribe immunity (pre-merge):</strong> Each week before the merge, pick which
            tribe wins immunity. Correct pick = +1 point.
          </li>
          <li className="survivor-dashboard__list-item">
            <strong>Vote-out:</strong> Pick who gets voted out each week. Correct pick = +2 points.
          </li>
          <li className="survivor-dashboard__list-item">
            <strong>Individual immunity (post-merge):</strong> After the merge, pick which castaway
            wins immunity each week. Correct pick = +1 point.
          </li>
        </ul>
        <p className="survivor-dashboard__card-body survivor-dashboard__card-body--no-margin">
          All picks lock when the episode starts.
        </p>
      </section>

      <section className="survivor-card" aria-labelledby="episode-results">
        <h2 id="episode-results" className="survivor-card__title">
          Episode results
        </h2>
        <p className="survivor-dashboard__card-body survivor-dashboard__card-body--sm">
          Official boots by episode. Scoring uses this list. Results publish Sunday 9:00 PM EST.
        </p>
        {episodeResults.length === 0 ? (
          <p className="survivor-dashboard__card-body survivor-dashboard__card-body--no-margin">
            No results yet.
          </p>
        ) : (
          <>
            <ul className="survivor-dashboard__list">
              {episodeResults.map(({ episodeNumber, bootNames }) => (
                <li
                  key={episodeNumber}
                  className="survivor-dashboard__episode-row"
                >
                  <strong>Episode {episodeNumber}:</strong> Boot{bootNames.length > 1 ? "s" : ""} = {bootNames.length > 0 ? bootNames.join(", ") : "—"}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/results"
              className="survivor-auth__link survivor-dashboard__link-block"
            >
              View all results →
            </Link>
          </>
        )}
      </section>

      <nav className="survivor-dashboard__actions-row" aria-label="Dashboard actions">
        <Link href="/dashboard/players" className="survivor-btn survivor-btn--secondary">
          View cast
        </Link>
        <Link href="/dashboard/leaderboard" className="survivor-btn survivor-btn--secondary">
          Leaderboard
        </Link>
      </nav>
    </div>
  );
}
