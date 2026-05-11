import { createClient } from "@/lib/supabase/server";
import { getSeason50TotalEpisodes, SEASON_50 } from "@/lib/season-50-countdown";

function copyForRemaining(remaining: number): { headline: string; sub: string } {
  if (remaining <= 0) {
    return {
      headline: "Finale territory: every point is legacy",
      sub: "No more room for maybes. One name rises. The rest become jury lore.",
    };
  }
  if (remaining === 1) {
    return {
      headline: "One shot at immortality",
      sub: "No reset button. No soft landing. The crown is one torch away.",
    };
  }
  if (remaining === 2) {
    return {
      headline: "Two councils. Two chances for chaos.",
      sub: "Alliances crack first. Egos crack second. The jury watches all of it.",
    };
  }
  if (remaining <= 4) {
    return {
      headline: "Endgame heat — play like you mean it",
      sub: "The merge is behind you. The fire is in front of you. Numbers do not lie, people still will.",
    };
  }
  return {
    headline: "The game only gets louder from here",
    sub: "Outwit. Outplay. Outlast. Every week is a new line in your legend, or your obituary.",
  };
}

export async function SeasonCountdownBanner() {
  const supabase = await createClient();
  const total = getSeason50TotalEpisodes();

  const { count, error } = await supabase
    .from("episodes")
    .select("id", { count: "exact", head: true })
    .eq("season", SEASON_50)
    .not("voted_out_player_id", "is", null);

  if (error) {
    return null;
  }

  const completed = count ?? 0;
  const remaining = Math.max(0, total - completed);
  const { headline, sub } = copyForRemaining(remaining);

  return (
    <aside
      className="survivor-countdown-banner"
      role="status"
      aria-live="polite"
      aria-label={`Season 50: ${remaining} ${remaining === 1 ? "episode" : "episodes"} remaining out of ${total} planned`}
    >
      <div className="survivor-countdown-banner__glow" aria-hidden />
      <div className="survivor-countdown-banner__inner">
        <p className="survivor-countdown-banner__eyebrow">Season 50 — In the Hands of the Fans</p>
        <p className="survivor-countdown-banner__headline">{headline}</p>
        <p className="survivor-countdown-banner__count" aria-hidden>
          <span className="survivor-countdown-banner__number">{remaining}</span>
          <span className="survivor-countdown-banner__suffix">
            {remaining === 1 ? "episode" : "episodes"} to go
          </span>
        </p>
        <p className="survivor-countdown-banner__sub">{sub}</p>
      </div>
    </aside>
  );
}
