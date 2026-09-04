import assert from "node:assert/strict";
import test from "node:test";
import { buildCampfireThreads } from "../lib/community";

test("Campfire replies stay beneath their idea in chronological order", () => {
  const profiles = [
    { id: "a", display_name: "Alex", team_name: "Torch Club", avatar_key: "torch" },
    { id: "b", display_name: "Blair", team_name: "", avatar_key: "wave" },
  ];
  const posts = [
    { id: 1, body: "Add a challenge", created_at: "2026-09-01T10:00:00Z", user_id: "a", parent_post_id: null },
    { id: 3, body: "Second reply", created_at: "2026-09-01T12:00:00Z", user_id: "a", parent_post_id: 1 },
    { id: 2, body: "First reply", created_at: "2026-09-01T11:00:00Z", user_id: "b", parent_post_id: 1 },
  ];
  const threads = buildCampfireThreads(posts, [], profiles, "a");
  assert.equal(threads.length, 1);
  assert.equal(threads[0].body, "Add a challenge");
  assert.deepEqual(threads[0].replies.map((reply) => reply.body), ["First reply", "Second reply"]);
});

test("Campfire idea votes determine Tribe Score without affecting replies", () => {
  const posts = [
    { id: 1, body: "First idea", created_at: "2026-09-01T10:00:00Z", user_id: "a", parent_post_id: null },
    { id: 2, body: "Second idea", created_at: "2026-09-01T11:00:00Z", user_id: "b", parent_post_id: null },
    { id: 3, body: "A reply", created_at: "2026-09-01T12:00:00Z", user_id: "b", parent_post_id: 1 },
  ];
  const votes = [
    { post_id: 1, user_id: "a", vote: 1 },
    { post_id: 1, user_id: "b", vote: 1 },
    { post_id: 2, user_id: "a", vote: -1 },
    { post_id: 3, user_id: "a", vote: 1 },
  ];
  const threads = buildCampfireThreads(posts, votes, [], "a");
  assert.deepEqual(threads.map((thread) => thread.id), [1, 2]);
  assert.deepEqual({ score: threads[0].score, myVote: threads[0].myVote }, { score: 2, myVote: 1 });
  assert.equal(threads[0].replies.length, 1);
});
