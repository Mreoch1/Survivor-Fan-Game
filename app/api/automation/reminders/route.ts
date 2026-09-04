import { castaways } from "../../../data";
import { carryForwardPicks } from "../../../../db/pick-carryover";
import { ensureDatabase, publishDueResults } from "../../../../db/runtime";
import {
  buildReminderEmail,
  getMissingRequiredPicks,
  getPickReceipts,
  type LeagueSnapshot,
  type ReminderPick,
} from "../../../../lib/reminder-email";
import { createAdminClient } from "../../../../lib/supabase/admin";

type Profile = {
  id: string;
  display_name: string;
  team_name: string;
  total_points: number;
  individual_game_pick: string | null;
  endgame_pick: string | null;
  created_at: string;
};

type ScoredPick = {
  user_id: string;
  favorite_point: number;
  immunity_point: number;
  boot_point: number;
  bonus_point: number;
  underdog_point: number;
  streak_point: number;
  double_point: number;
};

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.AUTO_RESULTS_SECRET || "";
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < supplied.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function score(row: ScoredPick) {
  return (
    row.favorite_point +
    row.immunity_point +
    row.boot_point +
    row.bonus_point +
    row.underdog_point +
    row.streak_point +
    row.double_point
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Automation access required" }, { status: 401 });
  await ensureDatabase();
  await publishDueResults();
  const db = createAdminClient();
  const now = Date.now();
  const { data: episode, error: episodeError } = await db
    .from("episodes")
    .select("id,title,air_at,lock_at,phase")
    .eq("results_posted", false)
    .gt("air_at", new Date(now).toISOString())
    .order("id")
    .limit(1)
    .maybeSingle();
  if (episodeError) throw episodeError;
  if (!episode) return Response.json({ pending: false, message: "No upcoming episode is scheduled" });
  const hoursUntilAir = (new Date(episode.air_at).getTime() - now) / 3_600_000;
  if (hoursUntilAir < 20 || hoursUntilAir > 28) {
    return Response.json({
      pending: false,
      message: "The next episode is outside the one-day reminder window",
      episodeId: episode.id,
      airAt: episode.air_at,
    });
  }

  await carryForwardPicks(episode.id);
  const [profilesResult, usersResult, currentPicksResult, latestPublishedResult, individualEventResult] =
    await Promise.all([
      db
        .from("profiles")
        .select("id,display_name,team_name,total_points,individual_game_pick,endgame_pick,created_at")
        .not("league_joined_at", "is", null)
        .order("total_points", { ascending: false })
        .order("created_at"),
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      db
        .from("picks")
        .select("user_id,favorite_id,immunity_pick,boot_pick,bonus_pick,double_down")
        .eq("episode_id", episode.id),
      db.from("episodes").select("id").eq("results_published", true).order("id", { ascending: false }).limit(1).maybeSingle(),
      db
        .from("episodes")
        .select("id")
        .eq("individual_game_started", true)
        .eq("results_published", true)
        .order("id")
        .limit(1)
        .maybeSingle(),
    ]);
  if (
    profilesResult.error ||
    usersResult.error ||
    currentPicksResult.error ||
    latestPublishedResult.error ||
    individualEventResult.error
  ) {
    throw (
      profilesResult.error ||
      usersResult.error ||
      currentPicksResult.error ||
      latestPublishedResult.error ||
      individualEventResult.error
    );
  }

  const profiles = (profilesResult.data || []) as Profile[];
  const currentPicks = new Map(
    (currentPicksResult.data || []).map((pick) => [pick.user_id, pick as ReminderPick & { user_id: string }]),
  );
  const emails = new Map(usersResult.data.users.map((user) => [user.id, user.email || ""]));
  const castawayName = (id: string | null | undefined) =>
    castaways.find((castaway) => castaway.id === id)?.name || null;

  let finalTorchDecisionOpen = false;
  if (individualEventResult.data) {
    const { data: nextAfterIndividual, error } = await db
      .from("episodes")
      .select("id,lock_at")
      .gt("id", individualEventResult.data.id)
      .order("id")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    finalTorchDecisionOpen = Boolean(
      nextAfterIndividual &&
        nextAfterIndividual.id === episode.id &&
        now < new Date(nextAfterIndividual.lock_at).getTime(),
    );
  }

  let rank = 0;
  let lastPoints: number | null = null;
  const ranked = profiles.map((profile, index) => {
    if (lastPoints !== profile.total_points) rank = index + 1;
    lastPoints = profile.total_points;
    return { ...profile, rank, publicName: profile.team_name || profile.display_name };
  });
  const leader = ranked[0]?.total_points > 0 ? ranked[0] : null;
  let latestScores = new Map<string, number>();
  if (latestPublishedResult.data) {
    const { data, error } = await db
      .from("picks")
      .select("user_id,favorite_point,immunity_point,boot_point,bonus_point,underdog_point,streak_point,double_point")
      .eq("episode_id", latestPublishedResult.data.id);
    if (error) throw error;
    latestScores = new Map(((data || []) as ScoredPick[]).map((pick) => [pick.user_id, score(pick)]));
  }
  const latestHighScore = latestScores.size ? Math.max(...latestScores.values()) : null;
  const latestHighScorerNames =
    latestHighScore === null
      ? []
      : ranked
          .filter((profile) => latestScores.get(profile.id) === latestHighScore)
          .map((profile) => profile.publicName);
  const leagueUrl = `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/play`;
  const subject = `Your voting booth closes tomorrow · Outlast 51 Episode ${episode.id}`;
  const players = ranked.flatMap((profile) => {
    const email = emails.get(profile.id) || "";
    const pick = currentPicks.get(profile.id) || null;
    const missingPicks = getMissingRequiredPicks({
      episodeId: episode.id,
      pick,
      profile,
      finalTorchDecisionOpen,
    });
    if (!email || !missingPicks.length) return [];
    const receipts = getPickReceipts({
      episodeId: episode.id,
      phase: episode.phase,
      pick,
      profile,
      finalTorchDecisionOpen,
      castawayName,
    });
    const snapshot: LeagueSnapshot = {
      playerRank: profile.rank,
      playerPoints: Number(profile.total_points),
      leaderName: leader?.publicName || null,
      leaderPoints: leader ? Number(leader.total_points) : null,
      latestEpisodeId: latestPublishedResult.data?.id || null,
      latestHighScorerNames,
      latestHighScore,
    };
    return [
      {
        name: profile.display_name,
        teamName: profile.team_name,
        email,
        missingPicks,
        picksOnFile: receipts,
        standing: snapshot,
        emailContent: buildReminderEmail({
          playerName: profile.display_name,
          teamName: profile.team_name,
          episodeId: episode.id,
          episodeTitle: episode.title,
          lockAt: episode.lock_at,
          leagueUrl,
          missingPicks,
          receipts,
          snapshot,
        }),
      },
    ];
  });
  if (!players.length) {
    return Response.json({
      pending: false,
      message: "Every joined player has the required picks on file",
      episodeId: episode.id,
    });
  }
  return Response.json({
    pending: true,
    episode: { id: episode.id, title: episode.title, airAt: episode.air_at, lockAt: episode.lock_at },
    players,
    leagueUrl,
    rules: {
      sendIndividually: true,
      spoilerFree: true,
      onlyMissingRequiredPicks: true,
      useExactEmailContent: true,
      recapPolicy: "League standings only; never include an episode recap or castaway results",
      subject,
    },
  });
}
