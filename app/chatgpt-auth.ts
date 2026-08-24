import { redirect } from "next/navigation";
import { createAuthClient } from "../lib/supabase/server";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  if (!email) return null;
  const metadata = data.claims.user_metadata as Record<string, unknown> | undefined;
  const fullName = typeof metadata?.display_name === "string" ? metadata.display_name : null;
  return { userId: data.claims.sub, email, fullName, displayName: fullName || email.split("@")[0] };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `/api/auth/signout?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (["/login", "/signup", "/auth/callback", "/api/auth/signout"].includes(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}
