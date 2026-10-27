import assert from "node:assert/strict";
import test from "node:test";
import { microsoftAuthFailureMessage, microsoftGraphFailureMessage } from "../scripts/mail-errors.mjs";

test("service-abuse blocks give the owner an explicit recovery action", () => {
  const message = microsoftAuthFailureMessage(new Error("invalid_grant: AADSTS70000: User account is found to be in service abuse mode."));
  assert.match(message || "", /outlasttorch51@outlook\.com/);
  assert.match(message || "", /account-unblock verification/);
  assert.match(message || "", /Do not reconnect/);
  assert.equal(microsoftAuthFailureMessage(new Error("AADSTS70000: InvalidGrant - Authentication failed.")), null);
  assert.equal(microsoftAuthFailureMessage(new Error("network timeout")), null);
});

test("Graph failures retain bounded Microsoft error details", () => {
  assert.equal(
    microsoftGraphFailureMessage(403, JSON.stringify({ error: { code: "ErrorAccessDenied", message: "Access is denied.  Retry later." } })),
    "Microsoft mail request failed (403): ErrorAccessDenied: Access is denied. Retry later.",
  );
  assert.equal(microsoftGraphFailureMessage(503, "not-json"), "Microsoft mail request failed (503); check the connection before retrying.");
});
