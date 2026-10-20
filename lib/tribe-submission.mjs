import fs from "node:fs";
import path from "node:path";

export const MAX_TRIBE_SUBMISSION_BYTES = 64 * 1024;
const submissionKeys = ["afterEpisodeId", "phase", "tribes", "assignments", "sources", "expectedPreviousAfterEpisodeId"];
const labelPattern = /^[\p{L}\p{N}][\p{L}\p{N} '\u2019-]*$/u;
const castIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

function objectWithKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error(`${label} must contain only its documented fields`);
  }
}

function label(value) {
  if (typeof value !== "string" || value.length > 40 || value !== value.trim() || !labelPattern.test(value)) {
    throw new Error("Tribe names and color labels must be short plain text");
  }
  return value;
}

/** Client shape validation only; live episode, roster and source verification stays on the server. */
export function sanitizeTribeSubmission(value) {
  objectWithKeys(value, submissionKeys, "Tribe submission");
  if (!Number.isSafeInteger(value.afterEpisodeId) || value.afterEpisodeId < 1 ||
    !Number.isSafeInteger(value.expectedPreviousAfterEpisodeId) || value.expectedPreviousAfterEpisodeId < 0) {
    throw new Error("Episode IDs must be nonnegative integers, with afterEpisodeId greater than zero");
  }
  if (value.phase !== "tribe" && value.phase !== "individual") throw new Error("Use tribe or individual phase");
  if (!Array.isArray(value.tribes) || value.tribes.length < 1 || value.tribes.length > 6) throw new Error("Provide one to six tribe objects");
  const tribes = value.tribes.map(tribe => {
    objectWithKeys(tribe, ["name", "color", "hex"], "Each tribe");
    if (typeof tribe.hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(tribe.hex)) throw new Error("Use a six-digit hex tribe color");
    return { name: label(tribe.name), color: label(tribe.color), hex: tribe.hex.toLowerCase() };
  });
  if (!value.assignments || typeof value.assignments !== "object" || Array.isArray(value.assignments) ||
    Object.getPrototypeOf(value.assignments) !== Object.prototype) throw new Error("Assignments must map cast IDs to tribe names");
  const entries = Object.entries(value.assignments);
  if (entries.length < 1 || entries.length > 100) throw new Error("Provide the cast tribe assignments");
  const assignments = Object.fromEntries(entries.map(([id, tribe]) => {
    if (id.length > 80 || !castIdPattern.test(id)) throw new Error("Use cast IDs from the tribe context");
    return [id, label(tribe)];
  }));
  if (!Array.isArray(value.sources) || value.sources.length < 2 || value.sources.length > 10) throw new Error("Provide two to ten evidence URLs");
  const sources = value.sources.map(source => {
    if (typeof source !== "string" || source.length > 2000 || /\s/.test(source)) throw new Error("Use HTTPS evidence URLs");
    let url;
    try { url = new URL(source); } catch { throw new Error("Use HTTPS evidence URLs"); }
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) throw new Error("Use public HTTPS evidence URLs without credentials");
    return url.href;
  });
  // Reconstruct every allowed field. Never send the original text or unknown JSON properties.
  return {
    afterEpisodeId: value.afterEpisodeId,
    phase: value.phase === "individual" ? "individual" : "tribe",
    tribes,
    assignments,
    sources,
    expectedPreviousAfterEpisodeId: value.expectedPreviousAfterEpisodeId,
  };
}

export function parseTribeSubmission(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_TRIBE_SUBMISSION_BYTES) {
    throw new Error("Tribe submission JSON must be at most 64 KiB");
  }
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("Provide a valid JSON tribe submission"); }
  return sanitizeTribeSubmission(value);
}

function isWithin(directory, filename) {
  const relative = path.relative(directory, filename);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function readTribeSubmissionFile(argument, repoRoot) {
  if (typeof argument !== "string" || !argument) throw new Error("Provide a JSON path inside this repository's outputs directory");
  const root = fs.realpathSync(repoRoot);
  const outputs = path.join(root, "outputs");
  // The output directory itself must stay in this checkout, including after resolving symlinks.
  if (fs.realpathSync(outputs) !== outputs || !fs.statSync(outputs).isDirectory()) throw new Error("Use this repository's outputs directory");
  const candidate = path.resolve(repoRoot, argument);
  const requestedOutputs = path.resolve(repoRoot, "outputs");
  if ((!isWithin(outputs, candidate) && !isWithin(requestedOutputs, candidate)) || path.extname(candidate) !== ".json") {
    throw new Error("Submission file must be JSON inside this repository's outputs directory");
  }
  const filename = fs.realpathSync(candidate);
  if (!isWithin(outputs, filename) || path.extname(filename) !== ".json") throw new Error("Submission symlinks must remain inside this repository's outputs directory");
  const descriptor = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_TRIBE_SUBMISSION_BYTES) throw new Error("Submission must be a regular JSON file at most 64 KiB");
    // A bounded read also prevents a file growing after the size check from escaping the limit.
    const buffer = Buffer.alloc(MAX_TRIBE_SUBMISSION_BYTES + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const read = fs.readSync(descriptor, buffer, bytes, buffer.length - bytes, bytes);
      if (read === 0) break;
      bytes += read;
    }
    if (bytes > MAX_TRIBE_SUBMISSION_BYTES) throw new Error("Submission JSON must be at most 64 KiB");
    return parseTribeSubmission(buffer.subarray(0, bytes).toString("utf8"));
  } finally { fs.closeSync(descriptor); }
}
