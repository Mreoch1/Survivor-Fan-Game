import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliveryKey, deliverOnce } from "../scripts/mail-delivery.mjs";
import { renderTreeMail } from "../lib/email-brand";

const recipient = "player@example.test";
const email = { subject: "Outlast 51 test", html: "<p>Test</p>", plainText: "Test" };

test("accepted mail is not submitted again on a retry or changed recipient casing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "outlast-mail-"));
  try {
    let calls = 0;
    const key = deliveryKey("reminder", "1", recipient);
    assert.equal(key, deliveryKey("reminder", "1", recipient.toUpperCase()));
    const graph = async (_path: string, options: { body: string }) => {
      calls++;
      const message = JSON.parse(options.body).message;
      assert.deepEqual(message.toRecipients, [{ emailAddress: { address: recipient } }]);
      assert.equal(message.body.contentType, "HTML");
      assert.equal(message.ccRecipients, undefined);
      return new Response(null, { status: 202 });
    };
    assert.equal((await deliverOnce({ graph, directory, key, recipient, email })).status, "accepted");
    assert.equal((await deliverOnce({ graph, directory, key, recipient, email })).status, "already-accepted");
    assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("ambiguous delivery stops retries instead of risking a duplicate", async () => {
  const directory = await mkdtemp(join(tmpdir(), "outlast-mail-"));
  try {
    let calls = 0;
    const graph = async () => { calls++; throw new Error("Timeout after send"); };
    const input = { graph, directory, key: deliveryKey("tree-mail", "2026-09-21", recipient), recipient, email };
    await assert.rejects(deliverOnce(input), /Timeout/);
    await assert.rejects(deliverOnce(input), /needs review/);
    assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("separate editions have separate keys and multi-recipient inputs are refused", () => {
  assert.notEqual(deliveryKey("reminder", "1", recipient), deliveryKey("reminder", "2", recipient));
  assert.throws(() => deliveryKey("reminder", "1", "a@example.com,b@example.com"));
});

test("editorial is escaped while exact score text and website spoiler notice stay intact", () => {
  const html = renderTreeMail({ scoreText: "Hi Mike,\n\nEpisode 2: -1.5 points · Round rank #2\n\nOpen when you are caught up.",
    editorial: [{ heading: "Camp <script>", paragraphs: ["A & B <img src=x onerror=alert(1)>"] }] });
  assert.match(html, /Episode 2: -1.5 points · Round rank #2/);
  assert.match(html, /Open when you are caught up/);
  assert.match(html, /Camp &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|<img src=x/i);
});
