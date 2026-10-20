import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { MAX_TRIBE_SUBMISSION_BYTES, parseTribeSubmission, readTribeSubmissionFile, sanitizeTribeSubmission } from "../lib/tribe-submission.mjs";

const fixture = () => ({ afterEpisodeId: 4, phase: "tribe", tribes: [{ name: "Savu", color: "Purple tribe", hex: "#6D4B86" }],
  assignments: { "alexis-levine": "Savu" }, sources: ["https://www.paramountplus.com/episode-4", "https://ew.com/recap"], expectedPreviousAfterEpisodeId: 0 });

test("submission reconstruction only emits the documented shape and copies nested values", () => {
  const input = fixture();
  const sanitized = sanitizeTribeSubmission(input);
  assert.deepEqual(Object.keys(sanitized), ["afterEpisodeId", "phase", "tribes", "assignments", "sources", "expectedPreviousAfterEpisodeId"]);
  assert.equal(sanitized.tribes[0].hex, "#6d4b86");
  input.tribes[0].name = "Changed"; input.assignments["alexis-levine"] = "Changed"; input.sources[0] = "https://changed.test";
  assert.equal(sanitized.tribes[0].name, "Savu");
  assert.equal(sanitized.assignments["alexis-levine"], "Savu");
  assert.equal(sanitized.sources[0], "https://www.paramountplus.com/episode-4");
  assert.deepEqual(parseTribeSubmission(JSON.stringify(fixture())), sanitized);
});

test("unknown fields, malformed scalars and nested content are rejected before a request can be built", () => {
  const valid = fixture();
  for (const value of [null, [], "not an object", { ...valid, token: "DO NOT SEND" }, { ...valid, afterEpisodeId: "4" },
    { ...valid, afterEpisodeId: 1.2 }, { ...valid, afterEpisodeId: Infinity }, { ...valid, expectedPreviousAfterEpisodeId: -1 },
    { ...valid, phase: { value: "tribe" } }, { ...valid, phase: "unknown" }, { ...valid, tribes: [] },
    { ...valid, tribes: [{ ...valid.tribes[0], rawFile: "DO NOT SEND" }] }, { ...valid, tribes: [{ ...valid.tribes[0], hex: "red;url(...)" }] },
    { ...valid, tribes: [{ ...valid.tribes[0], name: { value: "Savu" } }] }, { ...valid, tribes: [{ ...valid.tribes[0], color: "<script>" }] },
    { ...valid, assignments: [] }, { ...valid, assignments: { "alexis-levine": { tribe: "Savu", raw: "DO NOT SEND" } } },
    { ...valid, assignments: { "../.env": "Savu" } }, { ...valid, assignments: JSON.parse('{"__proto__":"Savu"}') },
    { ...valid, sources: [{ url: "https://ew.com/recap" }, valid.sources[0]] }, { ...valid, sources: ["file:///private/secret", valid.sources[0]] },
    { ...valid, sources: ["https://username:password@example.com", valid.sources[0]] }, { ...valid, sources: ["https://ew.com/recap\n", valid.sources[0]] }]) {
    assert.throws(() => sanitizeTribeSubmission(value));
  }
  const missing = { ...valid } as Record<string, unknown>; delete missing.phase;
  assert.throws(() => sanitizeTribeSubmission(missing));
  assert.throws(() => parseTribeSubmission("not json"));
  assert.throws(() => parseTribeSubmission(" ".repeat(MAX_TRIBE_SUBMISSION_BYTES + 1)), /64 KiB/);
});

test("file submissions are bounded regular JSON files contained in this checkout's real outputs directory", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "outlast-tribe-submission-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, "repo");
  const outputs = path.join(root, "outputs");
  fs.mkdirSync(outputs, { recursive: true });
  fs.mkdirSync(path.join(outputs, "nested"));
  const file = path.join(outputs, "nested", "tribes.json");
  fs.writeFileSync(file, JSON.stringify(fixture()));
  assert.deepEqual(readTribeSubmissionFile("outputs/nested/tribes.json", root), parseTribeSubmission(JSON.stringify(fixture())));
  assert.deepEqual(readTribeSubmissionFile(file, root), parseTribeSubmission(JSON.stringify(fixture())));

  const outside = path.join(directory, "outside.json");
  fs.writeFileSync(outside, JSON.stringify(fixture()));
  fs.symlinkSync(outside, path.join(outputs, "escape.json"));
  fs.symlinkSync(directory, path.join(outputs, "escape-directory"));
  fs.symlinkSync(file, path.join(outputs, "inside.json"));
  assert.deepEqual(readTribeSubmissionFile("outputs/inside.json", root), parseTribeSubmission(JSON.stringify(fixture())));
  fs.mkdirSync(path.join(outputs, "directory.json"));
  fs.writeFileSync(path.join(outputs, "huge.json"), Buffer.alloc(MAX_TRIBE_SUBMISSION_BYTES + 1, " "));
  fs.writeFileSync(path.join(outputs, "secret.env"), "PRIVATE_ENV_VALUE");
  fs.writeFileSync(path.join(outputs, "unexpected.json"), JSON.stringify({ ...fixture(), secret: "PRIVATE_ENV_VALUE" }));
  for (const candidate of [outside, "../outside.json", "outputs/../../outside.json", "outputs/escape.json", "outputs/escape-directory/outside.json",
    "outputs/directory.json", "outputs/huge.json", "outputs/secret.env", "outputs/unexpected.json"]) {
    assert.throws(() => readTribeSubmissionFile(candidate, root));
  }
  fs.renameSync(outputs, path.join(root, "saved-outputs"));
  fs.symlinkSync(path.join(root, "saved-outputs"), outputs);
  assert.throws(() => readTribeSubmissionFile("outputs/nested/tribes.json", root), /outputs directory/);
});

test("the CLI posts reconstructed JSON to its fixed endpoint and never sends invalid file contents", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "outlast-tribe-cli-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const folder of ["scripts", "lib", "outputs"]) fs.mkdirSync(path.join(directory, folder));
  for (const filename of ["scripts/auto-tribes.mjs", "lib/tribe-submission.mjs"]) {
    fs.copyFileSync(fileURLToPath(new URL(`../${filename}`, import.meta.url)), path.join(directory, filename));
  }
  fs.writeFileSync(path.join(directory, ".auto-results.env"), "AUTO_RESULTS_SECRET=fixture-only\n");
  fs.writeFileSync(path.join(directory, "outputs", "valid.json"), `${JSON.stringify(fixture(), null, 2)}   \n`);
  fs.writeFileSync(path.join(directory, "outputs", "invalid.json"), JSON.stringify({ ...fixture(), secret: "PRIVATE_FILE_CONTENT" }));
  const run = (filename: string) => spawnSync(process.execPath, ["--input-type=module", "-e", `
    process.argv = [process.execPath, "auto-tribes.mjs", "submit-file", ${JSON.stringify(filename)}];
    globalThis.fetch = async (url, options) => {
      console.log("REQUEST-MADE");
      return { ok: true, text: async () => JSON.stringify({ url, method: options.method, body: options.body }) };
    };
    await import(${JSON.stringify(pathToFileURL(path.join(directory, "scripts", "auto-tribes.mjs")).href)});
  `], { encoding: "utf8" });
  const valid = run("outputs/valid.json");
  assert.equal(valid.status, 0, valid.stderr);
  const posted = JSON.parse(valid.stdout.trim().split("\n").at(-1)!);
  assert.equal(posted.url, "https://survivor-fan-game.vercel.app/api/automation/tribes");
  assert.equal(posted.method, "POST");
  assert.equal(posted.body, JSON.stringify(sanitizeTribeSubmission(fixture())));
  const invalid = run("outputs/invalid.json");
  assert.notEqual(invalid.status, 0);
  assert.doesNotMatch(invalid.stdout, /REQUEST-MADE|PRIVATE_FILE_CONTENT/);
  assert.doesNotMatch(invalid.stderr, /PRIVATE_FILE_CONTENT/);
});
