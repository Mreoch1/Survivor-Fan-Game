import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PLAYERS } from "@/data/players";
import { TRIBES } from "@/data/players";
import type { TribeId } from "@/data/players";
import {
  updateEpisodeLockForm,
  updateEpisodeResultForm,
  updateUserProfileForm,
  updateUserScoresForm,
  deactivateUserForm,
  restoreUserForm,
} from "./actions";
import { ProcessEpisodeButton } from "./ProcessEpisodeButton";

const SEASON = 50;
const ADMIN_TABS = ["episodes", "users", "picks"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

/** Format for datetime-local input (YYYY-MM-DDTHH:mm). Handles ISO or Postgres timestamp strings. */
function toDatetimeLocal(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : String(value);
  const normalized = s.replace(" ", "T").slice(0, 16);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized) ? normalized : "";
}

function AdminLoadError({ message }: { message: string }) {
  return (
    <div className="survivor-card" style={{ maxWidth: "32rem", margin: "2rem auto", padding: "1.5rem" }}>
      <h2 className="survivor-card__title" style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
        Admin data could not load
      </h2>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1rem" }}>
        Check that all migrations are applied (e.g. <code>npm run db:push</code>) and that the database has the
        expected tables and columns.
      </p>
      <pre
        style={{
          fontSize: "0.75rem",
          padding: "0.75rem",
          background: "var(--survivor-bg)",
          border: "1px solid var(--survivor-border)",
          borderRadius: "0.25rem",
          overflow: "auto",
          marginBottom: "1rem",
          color: "var(--survivor-danger)",
        }}
      >
        {message}
      </pre>
      <Link href="/dashboard" className="survivor-btn survivor-btn--secondary">
        Back to dashboard
      </Link>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string; episode?: string }>;
}) {
  try {
    const { error: errorParam, tab: requestedTab, episode: requestedEpisode } = await searchParams;
    const activeTab: AdminTab = ADMIN_TABS.includes(requestedTab as AdminTab) ? (requestedTab as AdminTab) : "episodes";

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return <AdminLoadError message="Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment." />;
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (profileError) {
      return <AdminLoadError message={`Profile: ${profileError.message}`} />;
    }
    if (!profile?.is_admin) redirect("/dashboard");

    const episodesResWithMedevac = await supabase
      .from("episodes")
      .select("id, episode_number, vote_out_lock_at, voted_out_player_id, second_voted_out_player_id, third_voted_out_player_id, immunity_winning_tribe_id, medevac_player_id")
      .eq("season", SEASON)
      .order("episode_number", { ascending: true });
    const episodesRes =
      episodesResWithMedevac.error &&
      (episodesResWithMedevac.error.message?.includes("medevac_player_id") ||
        episodesResWithMedevac.error.message?.includes("second_voted_out_player_id") ||
        episodesResWithMedevac.error.message?.includes("third_voted_out_player_id"))
        ? await supabase
            .from("episodes")
            .select("id, episode_number, vote_out_lock_at, voted_out_player_id, immunity_winning_tribe_id")
            .eq("season", SEASON)
            .order("episode_number", { ascending: true })
        : episodesResWithMedevac;

    const immunityRes = await supabase.from("episode_immunity_tribes").select("episode_id, tribe_id");
    const immunityByEpisode = new Map<string, Set<string>>();
    if (!immunityRes.error) {
      (immunityRes.data ?? []).forEach((r: { episode_id: string; tribe_id: string }) => {
        if (!immunityByEpisode.has(r.episode_id)) immunityByEpisode.set(r.episode_id, new Set());
        immunityByEpisode.get(r.episode_id)!.add(r.tribe_id);
      });
    }

    const [profilesRes, pointsRes, winnerPicksRes, voteOutPicksRes, tribePicksRes] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, deactivated_at"),
      supabase
        .from("user_season_points")
        .select("user_id, points, survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points")
        .eq("season", SEASON),
      supabase.from("winner_picks").select("user_id, player_id").eq("season", SEASON),
      supabase
        .from("vote_out_picks")
        .select("user_id, episode_id, player_id, episodes(episode_number)"),
      supabase
        .from("tribe_immunity_picks")
        .select("user_id, episode_id, tribe_id, episodes(episode_number)"),
    ]);

    const err =
      episodesRes.error?.message ? `Episodes: ${episodesRes.error.message}` :
      profilesRes.error?.message ? `Profiles: ${profilesRes.error.message}` :
      pointsRes.error?.message ? `Points: ${pointsRes.error.message}` :
      winnerPicksRes.error?.message ? `Winner picks: ${winnerPicksRes.error.message}` :
      voteOutPicksRes.error?.message ? `Vote-out picks: ${voteOutPicksRes.error.message}` :
      tribePicksRes.error?.message ? `Tribe picks: ${tribePicksRes.error.message}` :
      null;
    if (err) {
      return <AdminLoadError message={err} />;
    }

    type EpisodeRow = {
      id: string;
      episode_number: number;
      vote_out_lock_at: string | null;
      voted_out_player_id: string | null;
      second_voted_out_player_id?: string | null;
      third_voted_out_player_id?: string | null;
      immunity_winning_tribe_id: string | null;
      medevac_player_id?: string | null;
    };
    const episodes = (episodesRes.data ?? []) as EpisodeRow[];
    const profiles = profilesRes.data ?? [];
    const pointsRows = pointsRes.data ?? [];
    const pointsByUser = new Map(pointsRows.map((r) => [r.user_id, r]));
    const hasMedevacColumn = episodes.some((ep) => "medevac_player_id" in ep);
    const hasSecondBootColumn = episodes.some((ep) => "second_voted_out_player_id" in ep);
    const hasThirdBootColumn = episodes.some((ep) => "third_voted_out_player_id" in ep);
    const playerNameById = new Map(PLAYERS.map((p) => [p.id, p.name]));
    const winnerPicksByUser = new Map((winnerPicksRes.data ?? []).map((row) => [row.user_id, row.player_id]));
    const voteOutPickRows = (voteOutPicksRes.data ?? []) as {
      user_id: string;
      episode_id: string;
      player_id: string;
      episodes: { episode_number: number } | { episode_number: number }[] | null;
    }[];
    const tribePickRows = (tribePicksRes.data ?? []) as {
      user_id: string;
      episode_id: string;
      tribe_id: TribeId;
      episodes: { episode_number: number } | { episode_number: number }[] | null;
    }[];
    const episodeById = new Map(episodes.map((ep) => [ep.id, ep]));
    const episodeNumberById = new Map(episodes.map((ep) => [ep.id, ep.episode_number]));
    const pickEpisodeId =
      requestedEpisode && episodeById.has(requestedEpisode)
        ? requestedEpisode
        : episodes.find((ep) => !ep.voted_out_player_id)?.id ?? episodes.at(-1)?.id ?? null;
    const pickEpisode = pickEpisodeId ? episodeById.get(pickEpisodeId) ?? null : null;
    const voteOutPickByUserForEpisode = new Map<string, string>();
    voteOutPickRows.forEach((row) => {
      if (row.episode_id === pickEpisodeId && !voteOutPickByUserForEpisode.has(row.user_id)) {
        voteOutPickByUserForEpisode.set(row.user_id, row.player_id);
      }
    });
    const tribePickByUserForEpisode = new Map<string, TribeId>();
    tribePickRows.forEach((row) => {
      if (row.episode_id === pickEpisodeId && !tribePickByUserForEpisode.has(row.user_id)) {
        tribePickByUserForEpisode.set(row.user_id, row.tribe_id);
      }
    });
    const latestVoteOutEpisodeByUser = new Map<string, number>();
    voteOutPickRows.forEach((row) => {
      const relation = row.episodes;
      const epNum = Array.isArray(relation) ? relation[0]?.episode_number : relation?.episode_number;
      const resolvedEpNum = epNum ?? (episodeNumberById.get(row.episode_id) ?? 0);
      const current = latestVoteOutEpisodeByUser.get(row.user_id) ?? 0;
      latestVoteOutEpisodeByUser.set(row.user_id, Math.max(current, resolvedEpNum));
    });
    const latestTribePickEpisodeByUser = new Map<string, number>();
    tribePickRows.forEach((row) => {
      const relation = row.episodes;
      const epNum = Array.isArray(relation) ? relation[0]?.episode_number : relation?.episode_number;
      const resolvedEpNum = epNum ?? (episodeNumberById.get(row.episode_id) ?? 0);
      const current = latestTribePickEpisodeByUser.get(row.user_id) ?? 0;
      latestTribePickEpisodeByUser.set(row.user_id, Math.max(current, resolvedEpNum));
    });

    return (

    <div className="survivor-dashboard">
      {errorParam && (
        <div
          role="alert"
          className="survivor-card"
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "var(--survivor-danger)",
            color: "var(--survivor-bg)",
            borderRadius: "0.5rem",
          }}
        >
          <strong>Save failed:</strong> {decodeURIComponent(errorParam)}
          <br />
          <Link href="/dashboard/admin" style={{ color: "var(--survivor-bg)", textDecoration: "underline", fontSize: "0.875rem" }}>
            Dismiss
          </Link>
        </div>
      )}
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Admin
      </h1>
      <p className="survivor-dashboard__welcome-subtext" style={{ marginBottom: "1.5rem" }}>
        Manage episodes (lock/unlock, set results, run scoring), users (names, scores, remove from group).
      </p>
      <nav aria-label="Admin sections" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Link
          href="/dashboard/admin?tab=episodes"
          className="survivor-btn survivor-btn--secondary"
          aria-current={activeTab === "episodes" ? "page" : undefined}
          style={activeTab === "episodes" ? { borderColor: "var(--survivor-accent)", color: "var(--survivor-accent)" } : undefined}
        >
          Episodes
        </Link>
        <Link
          href="/dashboard/admin?tab=users"
          className="survivor-btn survivor-btn--secondary"
          aria-current={activeTab === "users" ? "page" : undefined}
          style={activeTab === "users" ? { borderColor: "var(--survivor-accent)", color: "var(--survivor-accent)" } : undefined}
        >
          Users
        </Link>
        <Link
          href="/dashboard/admin?tab=picks"
          className="survivor-btn survivor-btn--secondary"
          aria-current={activeTab === "picks" ? "page" : undefined}
          style={activeTab === "picks" ? { borderColor: "var(--survivor-accent)", color: "var(--survivor-accent)" } : undefined}
        >
          Picks
        </Link>
      </nav>

      {activeTab === "episodes" && (
      <section className="survivor-card survivor-admin-episodes" aria-labelledby="admin-episodes">
        <h2 id="admin-episodes" className="survivor-card__title">
          Episodes
        </h2>
        <p className="survivor-dashboard__card-body survivor-dashboard__card-body--sm">
          Set up to three vote-outs (double or triple elimination weeks), optional medevac, and tribe immunity (check all winning tribes; +1 per correct pick). One Save results per row submits every vote-out field. Then run Process episode.
        </p>
        <p className="survivor-admin-episodes__scroll-hint" role="note">
          <span aria-hidden>↔</span>
          <span>This table is wide: scroll sideways inside the bordered area below to see Vote-out 2, Vote-out 3, Medevac, tribe checkboxes, Save, and Process.</span>
        </p>
        {(!hasSecondBootColumn || !hasThirdBootColumn) && (
          <p
            className="survivor-dashboard__card-body survivor-dashboard__card-body--sm"
            role="status"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--survivor-accent)",
              color: "var(--survivor-text)",
              background: "color-mix(in srgb, var(--survivor-accent) 12%, transparent)",
            }}
          >
            <strong>Vote-out 2 and/or 3 are hidden</strong> because the database response does not include those columns yet. Run{" "}
            <code style={{ fontSize: "0.875em" }}>npm run db:push</code> (apply migrations through 030+) so double and triple boots work, then refresh this page.
          </p>
        )}
        <div className="survivor-admin-episodes__scroll" tabIndex={0}>
          <table className="survivor-admin-episodes__table">
            <thead className="survivor-admin-episodes__thead">
              <tr>
                <th className="survivor-admin-episodes__th survivor-admin-episodes__th--ep" scope="col">
                  Ep
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Lock at
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Vote-out 1
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Vote-out 2
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Vote-out 3
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Medevac
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Tribe immunity
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Save
                </th>
                <th className="survivor-admin-episodes__th" scope="col">
                  Process
                </th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => {
                const resultFormId = `admin-episode-result-${ep.id}`;
                return (
                <tr key={ep.id}>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--ep">{ep.episode_number}</td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--lock">
                    <form action={updateEpisodeLockForm} className="survivor-admin-episodes__lock-form">
                      <input type="hidden" name="episodeId" value={ep.id} />
                      <input
                        type="datetime-local"
                        name="voteOutLockAt"
                        defaultValue={toDatetimeLocal(ep.vote_out_lock_at)}
                        className="survivor-auth__input"
                        aria-label={`Episode ${ep.episode_number} lock time`}
                        title={`Episode ${ep.episode_number} lock time`}
                      />
                      <button type="submit" className="survivor-btn survivor-btn--secondary">
                        Set lock
                      </button>
                    </form>
                  </td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--boot">
                    <form id={resultFormId} action={updateEpisodeResultForm}>
                      <input type="hidden" name="episodeId" value={ep.id} />
                    </form>
                    <label htmlFor={`v1-${ep.id}`} className="survivor-auth__label" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--survivor-text-muted)" }}>
                      Primary boot
                    </label>
                    <select
                      id={`v1-${ep.id}`}
                      form={resultFormId}
                      name="votedOutPlayerId"
                      className="survivor-auth__input survivor-admin-episodes__select"
                      defaultValue={ep.voted_out_player_id ?? ""}
                      title={
                        ep.voted_out_player_id
                          ? `${playerNameById.get(ep.voted_out_player_id) ?? ep.voted_out_player_id} (vote-out 1)`
                          : "Vote-out 1 (required to process)"
                      }
                      aria-label={`Episode ${ep.episode_number} vote-out 1`}
                    >
                      <option value="">—</option>
                      {PLAYERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--boot">
                    {hasSecondBootColumn ? (
                      <>
                        <label htmlFor={`v2-${ep.id}`} className="survivor-auth__label" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--survivor-text-muted)" }}>
                          Second boot
                        </label>
                        <select
                          id={`v2-${ep.id}`}
                          form={resultFormId}
                          name="secondVotedOutPlayerId"
                          className="survivor-auth__input survivor-admin-episodes__select"
                          defaultValue={ep.second_voted_out_player_id ?? ""}
                          title={
                            ep.second_voted_out_player_id
                              ? `${playerNameById.get(ep.second_voted_out_player_id) ?? ep.second_voted_out_player_id} (vote-out 2)`
                              : "Vote-out 2 (double elimination)"
                          }
                          aria-label={`Episode ${ep.episode_number} vote-out 2`}
                        >
                          <option value="">—</option>
                          {PLAYERS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <span style={{ color: "var(--survivor-text-muted)", fontSize: "0.8125rem" }} title="Run DB migrations for second boot column">—</span>
                    )}
                  </td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--boot">
                    {hasThirdBootColumn ? (
                      <>
                        <label htmlFor={`v3-${ep.id}`} className="survivor-auth__label" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--survivor-text-muted)" }}>
                          Third boot
                        </label>
                        <select
                          id={`v3-${ep.id}`}
                          form={resultFormId}
                          name="thirdVotedOutPlayerId"
                          className="survivor-auth__input survivor-admin-episodes__select"
                          defaultValue={ep.third_voted_out_player_id ?? ""}
                          title={
                            ep.third_voted_out_player_id
                              ? `${playerNameById.get(ep.third_voted_out_player_id) ?? ep.third_voted_out_player_id} (vote-out 3)`
                              : "Vote-out 3 (triple elimination)"
                          }
                          aria-label={`Episode ${ep.episode_number} vote-out 3`}
                        >
                          <option value="">—</option>
                          {PLAYERS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <span style={{ color: "var(--survivor-text-muted)", fontSize: "0.8125rem" }} title="Run DB migrations for third boot column">—</span>
                    )}
                  </td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--boot">
                    {hasMedevacColumn ? (
                      <>
                        <label htmlFor={`med-${ep.id}`} className="survivor-auth__label" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--survivor-text-muted)" }}>
                          Medevac / injury
                        </label>
                        <select
                          id={`med-${ep.id}`}
                          form={resultFormId}
                          name="medevacPlayerId"
                          className="survivor-auth__input survivor-admin-episodes__select"
                          defaultValue={ep.medevac_player_id ?? ""}
                          title={
                            ep.medevac_player_id
                              ? `${playerNameById.get(ep.medevac_player_id) ?? ep.medevac_player_id} (medevac)`
                              : "Medevac / injury"
                          }
                          aria-label={`Episode ${ep.episode_number} medevac`}
                        >
                          <option value="">—</option>
                          {PLAYERS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <span style={{ color: "var(--survivor-text-muted)", fontSize: "0.8125rem" }}>—</span>
                    )}
                  </td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--tribe">
                    <span className="survivor-admin-episodes__tribe-stack" title="Tribes that won immunity (check all)">
                      {(Object.keys(TRIBES) as TribeId[]).map((id) => (
                        <label key={id} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            form={resultFormId}
                            name="immunityTribeId"
                            value={id}
                            defaultChecked={immunityByEpisode.get(ep.id)?.has(id)}
                            aria-label={`Episode ${ep.episode_number} immunity ${TRIBES[id].name}`}
                          />
                          <span style={{ color: TRIBES[id].color, fontWeight: 600 }}>{TRIBES[id].name}</span>
                        </label>
                      ))}
                    </span>
                  </td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--action">
                    <button type="submit" form={resultFormId} className="survivor-btn survivor-btn--secondary">
                      Save results
                    </button>
                  </td>
                  <td className="survivor-admin-episodes__td survivor-admin-episodes__td--action">
                    <ProcessEpisodeButton episodeId={ep.id} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {episodes.length === 0 && (
          <p className="survivor-dashboard__card-body">No episodes. Add one in Supabase.</p>
        )}
      </section>
      )}

      {activeTab === "users" && (
      <section className="survivor-card" aria-labelledby="admin-users">
        <h2 id="admin-users" className="survivor-card__title">
          Users
        </h2>
        <p className="survivor-dashboard__card-body survivor-dashboard__card-body--sm">
          Edit display names and score breakdown. Remove from group hides the user from the leaderboard; restore to
          bring them back.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Name / Email</th>
                <th style={{ textAlign: "right", padding: "0.5rem" }}>Surv</th>
                <th style={{ textAlign: "right", padding: "0.5rem" }}>Tribe</th>
                <th style={{ textAlign: "right", padding: "0.5rem" }}>Vote-out</th>
                <th style={{ textAlign: "right", padding: "0.5rem" }}>Total</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((pro) => {
                const pts = pointsByUser.get(pro.id);
                return (
                  <tr
                    key={pro.id}
                    style={{
                      borderBottom: "1px solid var(--survivor-border)",
                      opacity: pro.deactivated_at ? 0.7 : 1,
                    }}
                  >
                    <td style={{ padding: "0.5rem" }}>
                      <form action={updateUserProfileForm} className="survivor-admin-inline">
                        <input type="hidden" name="userId" value={pro.id} />
                        <input
                          type="text"
                          name="displayName"
                          defaultValue={pro.display_name ?? ""}
                          placeholder="Display name"
                          className="survivor-auth__input"
                          style={{ width: "10rem" }}
                        />
                        <button type="submit" className="survivor-btn survivor-btn--secondary" style={{ marginLeft: "0.5rem" }}>
                          Save name
                        </button>
                      </form>
                      <span className="survivor-dashboard__card-body" style={{ display: "block", fontSize: "0.8125rem" }}>
                        {pro.email ?? pro.id}
                      </span>
                      {pro.deactivated_at && (
                        <span style={{ color: "var(--survivor-danger)", fontSize: "0.8125rem" }}>Removed from group</span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{pts?.survival_points ?? 0}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{pts?.tribe_immunity_points ?? 0}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{pts?.vote_out_points ?? 0}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 600 }}>{pts?.points ?? 0}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <form action={updateUserScoresForm} className="survivor-admin-inline" style={{ flexWrap: "wrap" }}>
                        <input type="hidden" name="userId" value={pro.id} />
                        <input type="number" name="survival_points" defaultValue={pts?.survival_points ?? 0} min={0} aria-label={`Survival points for ${pro.display_name ?? pro.email ?? pro.id}`} title="Survival points" className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="tribe_immunity_points" defaultValue={pts?.tribe_immunity_points ?? 0} min={0} aria-label={`Tribe immunity points for ${pro.display_name ?? pro.email ?? pro.id}`} title="Tribe immunity points" className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="vote_out_points" defaultValue={pts?.vote_out_points ?? 0} min={0} aria-label={`Vote-out points for ${pro.display_name ?? pro.email ?? pro.id}`} title="Vote-out points" className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="individual_immunity_points" defaultValue={pts?.individual_immunity_points ?? 0} min={0} aria-label={`Individual immunity points for ${pro.display_name ?? pro.email ?? pro.id}`} title="Individual immunity points" className="survivor-auth__input" style={{ width: "3rem" }} />
                        <button type="submit" className="survivor-btn survivor-btn--secondary" style={{ marginLeft: "0.5rem" }}>
                          Save scores
                        </button>
                      </form>
                      {pro.deactivated_at ? (
                        <form action={restoreUserForm} style={{ display: "inline", marginLeft: "0.5rem" }}>
                          <input type="hidden" name="userId" value={pro.id} />
                          <button type="submit" className="survivor-btn survivor-btn--secondary">
                            Restore
                          </button>
                        </form>
                      ) : (
                        <form action={deactivateUserForm} style={{ display: "inline", marginLeft: "0.5rem" }}>
                          <input type="hidden" name="userId" value={pro.id} />
                          <button type="submit" className="survivor-btn survivor-btn--secondary">
                            Remove from group
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === "picks" && (
      <section className="survivor-card" aria-labelledby="admin-picks">
        <h2 id="admin-picks" className="survivor-card__title">
          Everyone&apos;s picks
        </h2>
        <p className="survivor-dashboard__card-body survivor-dashboard__card-body--sm">
          Review winner picks and episode picks for appeal checks. Select an episode to inspect submitted vote-out and tribe immunity picks.
        </p>
        <form action="/dashboard/admin" method="get" className="survivor-admin-inline" style={{ marginBottom: "1rem" }}>
          <input type="hidden" name="tab" value="picks" />
          <label htmlFor="pick-episode" className="survivor-auth__label" style={{ marginBottom: 0 }}>
            Episode
          </label>
          <select
            id="pick-episode"
            name="episode"
            defaultValue={pickEpisodeId ?? ""}
            className="survivor-auth__input"
            style={{ width: "auto", minWidth: "10rem" }}
          >
            {episodes.map((ep) => (
              <option key={ep.id} value={ep.id}>
                Episode {ep.episode_number}
              </option>
            ))}
          </select>
          <button type="submit" className="survivor-btn survivor-btn--secondary">
            View picks
          </button>
        </form>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>User</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Winner pick</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>
                  Vote-out pick{pickEpisode ? ` (Ep ${pickEpisode.episode_number})` : ""}
                </th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>
                  Tribe immunity{pickEpisode ? ` (Ep ${pickEpisode.episode_number})` : ""}
                </th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Latest pick activity</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((pro) => {
                const winnerPickId = winnerPicksByUser.get(pro.id);
                const voteOutPickId = voteOutPickByUserForEpisode.get(pro.id);
                const tribePickId = tribePickByUserForEpisode.get(pro.id);
                const latestVoteEp = latestVoteOutEpisodeByUser.get(pro.id);
                const latestTribeEp = latestTribePickEpisodeByUser.get(pro.id);
                return (
                  <tr
                    key={pro.id}
                    style={{
                      borderBottom: "1px solid var(--survivor-border)",
                      opacity: pro.deactivated_at ? 0.7 : 1,
                    }}
                  >
                    <td style={{ padding: "0.5rem" }}>
                      <strong>{pro.display_name || "No display name"}</strong>
                      <span className="survivor-dashboard__card-body" style={{ display: "block", fontSize: "0.8125rem" }}>
                        {pro.email ?? pro.id}
                      </span>
                      {pro.deactivated_at && (
                        <span style={{ color: "var(--survivor-danger)", fontSize: "0.8125rem" }}>Removed from group</span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {winnerPickId ? playerNameById.get(winnerPickId) ?? "Unknown player" : "No pick"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {voteOutPickId ? playerNameById.get(voteOutPickId) ?? "Unknown player" : "No pick"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {tribePickId ? (
                        <span style={{ color: TRIBES[tribePickId].color, fontWeight: 600 }}>{TRIBES[tribePickId].name}</span>
                      ) : (
                        "No pick"
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <span className="survivor-dashboard__card-body survivor-dashboard__card-body--sm">
                        Latest vote-out pick: {latestVoteEp ? `Ep ${latestVoteEp}` : "None"}
                      </span>
                      <span className="survivor-dashboard__card-body survivor-dashboard__card-body--sm" style={{ display: "block" }}>
                        Latest tribe pick: {latestTribeEp ? `Ep ${latestTribeEp}` : "None"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}

      <p className="survivor-dashboard__welcome-subtext">
        <Link href="/dashboard" className="survivor-auth__link">
          ← Back to dashboard
        </Link>
      </p>
    </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Admin page load error:", err);
    return <AdminLoadError message={message} />;
  }
}
