import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PLAYERS } from "@/data/players";
import { TRIBES } from "@/data/players";
import type { TribeId } from "@/data/players";
import {
  updateEpisodeLock,
  updateEpisodeResult,
  updateUserProfile,
  updateUserScores,
  deactivateUser,
  restoreUser,
} from "./actions";
import { ProcessEpisodeButton } from "./ProcessEpisodeButton";

const SEASON = 50;

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, vote_out_lock_at, voted_out_player_id, immunity_winning_tribe_id")
    .eq("season", SEASON)
    .order("episode_number", { ascending: true });

  const { data: profiles } = await supabase.from("profiles").select("id, email, display_name, deactivated_at");
  const { data: pointsRows } = await supabase
    .from("user_season_points")
    .select("user_id, points, survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points")
    .eq("season", SEASON);

  const pointsByUser = new Map(pointsRows?.map((r) => [r.user_id, r]) ?? []);

  return (
    <div className="survivor-dashboard">
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Admin
      </h1>
      <p className="survivor-dashboard__welcome-subtext" style={{ marginBottom: "1.5rem" }}>
        Manage episodes (lock/unlock, set results, run scoring), users (names, scores, remove from group).
      </p>

      <section className="survivor-card" aria-labelledby="admin-episodes">
        <h2 id="admin-episodes" className="survivor-card__title">
          Episodes
        </h2>
        <p className="survivor-dashboard__card-body survivor-dashboard__card-body--sm">
          Set who was voted out and (optional) which tribe won immunity, then run &quot;Process episode&quot; to apply
          scoring. Adjust lock time to unlock or lock picks for that episode.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Ep</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Lock at</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Voted out / Immunity</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Process</th>
              </tr>
            </thead>
            <tbody>
              {(episodes ?? []).map((ep) => (
                <tr key={ep.id} style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                  <td style={{ padding: "0.5rem" }}>{ep.episode_number}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <form action={updateEpisodeLock.bind(null, ep.id)} className="survivor-admin-inline">
                      <input
                        type="datetime-local"
                        name="voteOutLockAt"
                        defaultValue={ep.vote_out_lock_at?.slice(0, 16)}
                        className="survivor-auth__input"
                        style={{ width: "auto", minWidth: "12rem" }}
                      />
                      <button type="submit" className="survivor-btn survivor-btn--secondary" style={{ marginLeft: "0.5rem" }}>
                        Set lock
                      </button>
                    </form>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <form action={updateEpisodeResult.bind(null, ep.id)} className="survivor-admin-inline">
                      <select
                        name="votedOutPlayerId"
                        className="survivor-auth__input"
                        style={{ width: "auto", minWidth: "10rem" }}
                        defaultValue={ep.voted_out_player_id ?? ""}
                      >
                        <option value="">—</option>
                        {PLAYERS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="immunityWinningTribeId"
                        className="survivor-auth__input"
                        style={{ width: "auto", marginLeft: "0.5rem" }}
                        defaultValue={ep.immunity_winning_tribe_id ?? ""}
                      >
                        <option value="">—</option>
                        {(Object.keys(TRIBES) as TribeId[]).map((id) => (
                          <option key={id} value={id}>
                            {TRIBES[id].name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="survivor-btn survivor-btn--secondary" style={{ marginLeft: "0.5rem" }}>
                        Save results
                      </button>
                    </form>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <ProcessEpisodeButton episodeId={ep.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!episodes || episodes.length === 0) && (
          <p className="survivor-dashboard__card-body">No episodes. Add one in Supabase.</p>
        )}
      </section>

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
              {(profiles ?? []).map((pro) => {
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
                      <form action={updateUserProfile.bind(null, pro.id)} className="survivor-admin-inline">
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
                      <form
                        action={updateUserScores.bind(null, pro.id)}
                        className="survivor-admin-inline"
                        style={{ flexWrap: "wrap" }}
                      >
                        <input type="number" name="survival_points" defaultValue={pts?.survival_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="tribe_immunity_points" defaultValue={pts?.tribe_immunity_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="vote_out_points" defaultValue={pts?.vote_out_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="individual_immunity_points" defaultValue={pts?.individual_immunity_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
                        <button type="submit" className="survivor-btn survivor-btn--secondary" style={{ marginLeft: "0.5rem" }}>
                          Save scores
                        </button>
                      </form>
                      {pro.deactivated_at ? (
                        <form action={restoreUser.bind(null, pro.id)} style={{ display: "inline", marginLeft: "0.5rem" }}>
                          <button type="submit" className="survivor-btn survivor-btn--secondary">
                            Restore
                          </button>
                        </form>
                      ) : (
                        <form action={deactivateUser.bind(null, pro.id)} style={{ display: "inline", marginLeft: "0.5rem" }}>
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

      <p className="survivor-dashboard__welcome-subtext">
        <Link href="/dashboard" className="survivor-auth__link">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
