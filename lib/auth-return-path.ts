export function safeAuthReturnPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/play";
  const origin = "https://league.local";
  try {
    const target = new URL(value, origin);
    // URL parsing strips some control characters: check the normalized origin too.
    if (target.origin !== origin) return "/play";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/play";
  }
}
