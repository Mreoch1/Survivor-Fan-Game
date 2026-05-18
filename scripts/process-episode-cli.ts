/**
 * Process points for one Season 50 episode (service role).
 * Usage: npx tsx scripts/process-episode-cli.ts 12
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceRoleClient } from "../src/lib/supabase/service-role";
import { processEpisode } from "../src/lib/process-episode";

const root = resolve(__dirname, "..");

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const episodeNumber = Number.parseInt(process.argv[2] ?? "", 10);
if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
  console.error("Usage: npx tsx scripts/process-episode-cli.ts <episode_number>");
  process.exit(1);
}

async function main() {
  const supabase = createServiceRoleClient();
  const { data: ep, error: epErr } = await supabase
    .from("episodes")
    .select("id, episode_number, voted_out_player_id")
    .eq("season", 50)
    .eq("episode_number", episodeNumber)
    .single();

  if (epErr || !ep) {
    console.error("Episode not found:", epErr?.message ?? "no row");
    process.exit(1);
  }

  if (!ep.voted_out_player_id) {
    console.error(
      `Episode ${episodeNumber} has no voted_out_player_id. Save results in Admin or run db:push first.`
    );
    process.exit(1);
  }

  const result = await processEpisode(supabase, ep.id);
  if (!result.ok) {
    console.error("Process failed:", result.error);
    process.exit(1);
  }

  console.log(`Episode ${episodeNumber} processed (${ep.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
