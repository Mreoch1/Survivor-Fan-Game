#!/usr/bin/env node
/**
 * Set Survivor-themed auth email templates in Supabase via Management API.
 * Requires: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF (or NEXT_PUBLIC_SUPABASE_URL).
 *
 * Get token: https://supabase.com/dashboard/account/tokens
 * Run: npm run email-templates
 * Or: node --env-file=.env.local scripts/setup-email-templates.mjs (Node 20+)
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templatesDir = join(root, "docs", "email-templates");

function loadEnvLocal() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnvLocal();

function loadHtml(name) {
  const raw = readFileSync(join(templatesDir, `${name}.html`), "utf8");
  const firstLine = raw.indexOf("\n");
  return firstLine >= 0 ? raw.slice(firstLine + 1).trim() : raw.trim();
}

function getProjectRef() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (ref) return ref;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
    if (m) return m[1];
  }
  return null;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = getProjectRef();

  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN. Get one at https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }
  if (!projectRef) {
    console.error("Missing SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL (with project ref in hostname)");
    process.exit(1);
  }

  const confirmationContent = loadHtml("confirm-signup");
  const recoveryContent = loadHtml("reset-password");
  const inviteContent = loadHtml("invite");
  const magicLinkContent = loadHtml("magic-link");

  const body = {
    mailer_subjects_confirmation: "Confirm your spot on the island",
    mailer_templates_confirmation_content: confirmationContent,
    mailer_subjects_recovery: "Reset your torch",
    mailer_templates_recovery_content: recoveryContent,
    mailer_subjects_invite: "You're invited to Survivor Fan Game",
    mailer_templates_invite_content: inviteContent,
    mailer_subjects_magic_link: "Your link to the island",
    mailer_templates_magic_link_content: magicLinkContent,
  };

  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`API error ${res.status}: ${text}`);
    process.exit(1);
  }

  console.log("Email templates updated:");
  console.log("  Confirm signup: Confirm your spot on the island");
  console.log("  Reset password: Reset your torch");
  console.log("  Invite: You're invited to Survivor Fan Game");
  console.log("  Magic link: Your link to the island");
}

main();
