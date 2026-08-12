import { createHmac, timingSafeEqual } from "node:crypto";

interface WebhookVerificationInput {
  body: string;
  timestamp: number;
  signature: string;
  secret: string;
  now?: number;
  toleranceSeconds?: number;
}

export function signWebhookPayload(body: string, timestamp: number, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyWebhookSignature({
  body,
  timestamp,
  signature,
  secret,
  now = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
}: WebhookVerificationInput) {
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) return false;
  const expected = signWebhookPayload(body, timestamp, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
