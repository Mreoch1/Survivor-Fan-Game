import assert from "node:assert/strict";
import test from "node:test";
import { isProfileIconKey, profileIcon, profileIcons } from "../app/profile-icons";

test("player icons have stable unique keys", () => {
  assert.equal(new Set(profileIcons.map((icon) => icon.key)).size, profileIcons.length);
  for (const icon of profileIcons) assert.equal(isProfileIconKey(icon.key), true);
});

test("unknown avatar values safely fall back to the torch", () => {
  assert.equal(isProfileIconKey("pirate"), false);
  assert.equal(profileIcon("pirate").key, "torch");
});
