import { describe, expect, it } from "vitest";

import { signWebhookPayload, verifyWebhookSignature } from "./webhook-signature";

describe("analysis callback signature", () => {
  it("verifies an untampered recent payload", () => {
    const timestamp = 1_800_000_000;
    const body = JSON.stringify({ jobId: "job-1", status: "analyzing" });
    const signature = signWebhookPayload(body, timestamp, "secret");
    expect(verifyWebhookSignature({ body, timestamp, signature, secret: "secret", now: timestamp })).toBe(true);
  });

  it("rejects replayed or modified payloads", () => {
    const timestamp = 1_800_000_000;
    const signature = signWebhookPayload("original", timestamp, "secret");
    expect(verifyWebhookSignature({ body: "changed", timestamp, signature, secret: "secret", now: timestamp })).toBe(false);
    expect(verifyWebhookSignature({ body: "original", timestamp, signature, secret: "secret", now: timestamp + 301 })).toBe(false);
  });
});
