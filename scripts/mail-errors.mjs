const mailbox = "outlasttorch51@outlook.com";

export function microsoftAuthFailureMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (!/service abuse mode/i.test(message)) return null;
  return `Outlast Microsoft account ${mailbox} is blocked by Microsoft for suspected abuse (AADSTS70000). The owner must sign in to Outlook.com and complete Microsoft's account-unblock verification. Do not reconnect, change senders, or retry deliveries while the account is blocked.`;
}

export function microsoftGraphFailureMessage(status, body) {
  let code = "";
  let message = "";
  try {
    const parsed = JSON.parse(body);
    code = typeof parsed?.error?.code === "string" ? parsed.error.code : "";
    message = typeof parsed?.error?.message === "string" ? parsed.error.message : "";
  } catch {
    // Non-JSON responses use the existing status-only fallback.
  }
  const safeCode = code.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  const safeMessage = message.replace(/\s+/g, " ").trim().slice(0, 300);
  const detail = [safeCode, safeMessage].filter(Boolean).join(": ");
  return `Microsoft mail request failed (${status})${detail ? `: ${detail}` : "; check the connection before retrying."}`;
}
