import fs from "node:fs";

// `context` documents the exact target, full roster, previous snapshot and POST payload.
// Save verified JSON in ignored outputs/, then use `submit-file outputs/auto-tribes.json`.
const root = new URL("../", import.meta.url);
const envPath = new URL(".auto-results.env", root);
const config = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter(Boolean).map(line => {
  const at = line.indexOf("=");
  return [line.slice(0, at), line.slice(at + 1)];
}));
const mode = process.argv[2] || "context";
if (!["context", "submit", "submit-file"].includes(mode)) throw new Error("Use context, submit <JSON>, or submit-file <path>");
const options = { headers: { authorization: `Bearer ${config.AUTO_RESULTS_SECRET}`, "content-type": "application/json" } };
if (mode !== "context") {
  const argument = process.argv[3];
  if (!argument) throw new Error("Provide verified tribe JSON or a JSON file path");
  const input = mode === "submit-file" ? fs.readFileSync(argument, "utf8") : argument;
  JSON.parse(input);
  options.method = "POST";
  options.body = input;
}
const response = await fetch("https://survivor-fan-game.vercel.app/api/automation/tribes", options);
const output = await response.text();
if (!response.ok) throw new Error(`Tribe automation failed (${response.status}): ${output}`);
console.log(output);
