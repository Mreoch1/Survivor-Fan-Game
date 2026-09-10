import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getChatGPTUser } from "../chatgpt-auth";
import { safeAuthReturnPath } from "../../lib/auth-return-path";
import { REMEMBER_COOKIE } from "../../lib/supabase/session-cookies";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  if (await getChatGPTUser()) redirect(safeAuthReturnPath(returnTo ?? null));
  const remembered = (await cookies()).get(REMEMBER_COOKIE)?.value !== "false";
  return <LoginForm defaultRemembered={remembered}/>;
}
