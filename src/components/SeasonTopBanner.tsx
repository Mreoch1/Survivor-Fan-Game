import { getSeason50WinnerDisplay } from "@/lib/season-50-winner-display";
import { SeasonCountdownBanner } from "@/components/SeasonCountdownBanner";
import { SeasonWinnerBanner } from "@/components/SeasonWinnerBanner";

export async function SeasonTopBanner() {
  const display = await getSeason50WinnerDisplay();
  if (display) return <SeasonWinnerBanner display={display} />;
  return <SeasonCountdownBanner />;
}
