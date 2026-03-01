"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) throw new Error("Admin only");
  return supabase;
}

export async function updateEpisodeLock(episodeId: string, formData: FormData) {
  const voteOutLockAt = formData.get("voteOutLockAt") as string | null;
  if (!voteOutLockAt) return { error: "Lock time required" };
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("episodes")
    .update({ vote_out_lock_at: voteOutLockAt, updated_at: new Date().toISOString() })
    .eq("id", episodeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  return {};
}

export async function updateEpisodeResult(episodeId: string, formData: FormData) {
  const votedOutPlayerId = (formData.get("votedOutPlayerId") as string) || null;
  const immunityWinningTribeId = (formData.get("immunityWinningTribeId") as string) || null;
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("episodes")
    .update({
      voted_out_player_id: votedOutPlayerId,
      immunity_winning_tribe_id: immunityWinningTribeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", episodeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  return {};
}

export async function updateUserProfile(userId: string, formData: FormData) {
  const displayName = (formData.get("displayName") as string) || null;
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
  return {};
}

export async function updateUserScores(userId: string, formData: FormData) {
  const survival_points = Number(formData.get("survival_points")) || 0;
  const tribe_immunity_points = Number(formData.get("tribe_immunity_points")) || 0;
  const individual_immunity_points = Number(formData.get("individual_immunity_points")) || 0;
  const vote_out_points = Number(formData.get("vote_out_points")) || 0;
  const points = survival_points + tribe_immunity_points + individual_immunity_points + vote_out_points;
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("user_season_points")
    .upsert(
      {
        user_id: userId,
        season: 50,
        survival_points,
        tribe_immunity_points,
        individual_immunity_points,
        vote_out_points,
        points,
      },
      { onConflict: "user_id,season" }
    );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
  return {};
}

export async function deactivateUser(userId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
  return {};
}

export async function restoreUser(userId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
  return {};
}
