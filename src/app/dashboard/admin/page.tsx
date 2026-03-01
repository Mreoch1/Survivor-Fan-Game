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

export default async function AdminPage() {
  try {
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

    const [episodesRes, profilesRes, pointsRes] = await Promise.all([
      supabase
        .from("episodes")
        .select("id, episode_number, vote_out_lock_at, voted_out_player_id, immunity_winning_tribe_id")
        .eq("season", SEASON)
        .order("episode_number", { ascending: true }),
      supabase.from("profiles").select("id, email, display_name, deactivated_at"),
      supabase
        .from("user_season_points")
        .select("user_id, points, survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points")
        .eq("season", SEASON),
    ]);

    const err =
      episodesRes.error?.message ? `Episodes: ${episodesRes.error.message}` :
      profilesRes.error?.message ? `Profiles: ${profilesRes.error.message}` :
      pointsRes.error?.message ? `Points: ${pointsRes.error.message}` :
      null;
    if (err) {
      return <AdminLoadError message={err} />;
    }

    const episodes = episodesRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const pointsRows = pointsRes.data ?? [];
    const pointsByUser = new Map(pointsRows.map((r) => [r.user_id, r]));

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
              {episodes.map((ep) => (
                <tr key={ep.id} style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                  <td style={{ padding: "0.5rem" }}>{ep.episode_number}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <form action={updateEpisodeLockForm} className="survivor-admin-inline">
                      <input type="hidden" name="episodeId" value={ep.id} />
                      <input
                        type="datetime-local"
                        name="voteOutLockAt"
                        defaultValue={toDatetimeLocal(ep.vote_out_lock_at)}
                        className="survivor-auth__input"
                        style={{ width: "auto", minWidth: "12rem" }}
                      />
                      <button type="submit" className="survivor-btn survivor-btn--secondary" style={{ marginLeft: "0.5rem" }}>
                        Set lock
                      </button>
                    </form>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <form action={updateEpisodeResultForm} className="survivor-admin-inline">
                      <input type="hidden" name="episodeId" value={ep.id} />
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
        {episodes.length === 0 && (
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
                        <input type="number" name="survival_points" defaultValue={pts?.survival_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="tribe_immunity_points" defaultValue={pts?.tribe_immunity_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="vote_out_points" defaultValue={pts?.vote_out_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
                        <input type="number" name="individual_immunity_points" defaultValue={pts?.individual_immunity_points ?? 0} min={0} className="survivor-auth__input" style={{ width: "3rem" }} />
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
