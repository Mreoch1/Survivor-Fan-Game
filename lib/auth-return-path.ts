export function safeAuthReturnPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/play";
  const origin = "https://league.local";
  try {
    const target = new URL(value, origin);
    // Normalization can strip controls or create a protocol-relative pathname.
    if (target.origin !== origin || target.pathname.startsWith("//")) return "/play";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/play";
  }
}
