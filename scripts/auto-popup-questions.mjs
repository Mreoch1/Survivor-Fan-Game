import fs from "node:fs";

const root = new URL("../", import.meta.url);
const envPath = new URL(".auto-results.env", root);
const config = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter(Boolean).map(line => {
  const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)];
}));
const base = "https://survivor-fan-game.vercel.app";
const headers = { authorization: `Bearer ${config.AUTO_RESULTS_SECRET}`, "content-type": "application/json" };
const mode = process.argv[2] || "context";
const options = { headers };
if (mode === "submit" || mode === "submit-file") {
  const argument = process.argv[3];
  if (!argument) throw new Error("Provide structured weekly popup JSON or a JSON file path");
  const input = mode === "submit-file" ? fs.readFileSync(argument, "utf8") : argument;
  JSON.parse(input); options.method = "POST"; options.body = input;
} else if (mode !== "context") throw new Error("Use context, submit, or submit-file");
const response = await fetch(`${base}/api/automation/popup-questions`, options);
const text = await response.text();
if (!response.ok) throw new Error(`Weekly popup automation failed (${response.status}): ${text}`);
console.log(text);
