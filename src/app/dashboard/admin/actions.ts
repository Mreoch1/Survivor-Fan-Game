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

export async function updateEpisodeLock(episodeId: string, formData: FormData): Promise<void> {
  const voteOutLockAt = formData.get("voteOutLockAt") as string | null;
  if (!voteOutLockAt) throw new Error("Lock time required");
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("episodes")
    .update({ vote_out_lock_at: voteOutLockAt, updated_at: new Date().toISOString() })
    .eq("id", episodeId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function updateEpisodeLockForm(formData: FormData): Promise<void> {
  const episodeId = formData.get("episodeId");
  if (!episodeId || typeof episodeId !== "string") throw new Error("Missing episodeId");
  return updateEpisodeLock(episodeId, formData);
}

export async function updateEpisodeResult(episodeId: string, formData: FormData): Promise<void> {
  const votedOutPlayerId = (formData.get("votedOutPlayerId") as string) || null;
  const immunityWinningTribeId = (formData.get("immunityWinningTribeId") as string) || null;
  const medevacPlayerId = (formData.get("medevacPlayerId") as string) || null;
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("episodes")
    .update({
      voted_out_player_id: votedOutPlayerId,
      immunity_winning_tribe_id: immunityWinningTribeId,
      medevac_player_id: medevacPlayerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", episodeId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function updateEpisodeResultForm(formData: FormData): Promise<void> {
  const episodeId = formData.get("episodeId");
  if (!episodeId || typeof episodeId !== "string") throw new Error("Missing episodeId");
  return updateEpisodeResult(episodeId, formData);
}

export async function updateUserProfile(userId: string, formData: FormData): Promise<void> {
  const displayName = (formData.get("displayName") as string) || null;
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
}

export async function updateUserProfileForm(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  if (!userId || typeof userId !== "string") throw new Error("Missing userId");
  return updateUserProfile(userId, formData);
}

export async function updateUserScores(userId: string, formData: FormData): Promise<void> {
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
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
}

export async function updateUserScoresForm(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  if (!userId || typeof userId !== "string") throw new Error("Missing userId");
  return updateUserScores(userId, formData);
}

export async function deactivateUser(userId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
}

export async function deactivateUserForm(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  if (!userId || typeof userId !== "string") throw new Error("Missing userId");
  return deactivateUser(userId);
}

export async function restoreUser(userId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/leaderboard");
}

export async function restoreUserForm(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  if (!userId || typeof userId !== "string") throw new Error("Missing userId");
  return restoreUser(userId);
}
