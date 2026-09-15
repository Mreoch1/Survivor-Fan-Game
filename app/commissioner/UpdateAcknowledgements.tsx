import { createAdminClient } from "../../lib/supabase/admin";
import { publishedUpdates } from "../../lib/league-updates";
import { getChatGPTUser } from "../chatgpt-auth";
import { isCommissioner } from "../../db/runtime";

export async function UpdateAcknowledgements() {
  const user = await getChatGPTUser();
  if (!user || !isCommissioner(user.email)) return null;
  const latest = publishedUpdates().at(-1);
  if (!latest) return null;
  const db = createAdminClient();
  const [profiles, acknowledgements] = await Promise.all([
    db.from("profiles").select("id,display_name,team_name,league_joined_at").order("created_at"),
    db.from("league_update_acknowledgements").select("user_id,acknowledged_at").eq("update_id", latest.id),
  ]);
  if (profiles.error || acknowledgements.error) return <section className="acknowledgement-panel"><h2>Update confirmations</h2><p role="status">Confirmations could not load. Refresh the page to try again.</p></section>;
  const receipts = new Map((acknowledgements.data || []).map(row => [row.user_id, row.acknowledged_at]));
  const players = profiles.data || [];
  const confirmed = players.filter(player => receipts.has(player.id)).length;
  return <section className="acknowledgement-panel"><p className="eyebrow">Who has confirmed the latest update?</p><h2>{latest.title}</h2><p><strong>{confirmed} of {players.length} players</strong> have tapped Got it. Refresh this page for the latest confirmations.</p>
    <ul className="acknowledgement-list">{players.map(player => {
      const date = receipts.get(player.id);
      return <li key={player.id}><span><strong>{player.display_name || "Unnamed player"}</strong><small>{player.league_joined_at ? player.team_name || "Joined the league" : "Still needs to join the league"}</small></span><span className={date ? "acknowledged" : "not-acknowledged"}>{date ? "Confirmed" : "Not confirmed yet"}{date && <small>{new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })} ET</small>}</span></li>;
    })}</ul><a href="/updates">Review the notice players see</a>
  </section>;
}
