import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * The Google refresh token at rest.
 *
 * AES-256-GCM with a key that exists only in the web app's environment
 * (`GMAIL_TOKEN_KEY`, 32 random bytes, base64). The database holds ciphertext;
 * anyone who reads the table — including through the app's own client — gets
 * bytes that are useless without the key, and the key never touches the
 * database. Stored as base64(iv ‖ tag ‖ ciphertext).
 */

function key(): Buffer {
  const raw = process.env.GMAIL_TOKEN_KEY;
  if (!raw) throw new Error("GMAIL_TOKEN_KEY is not set");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("GMAIL_TOKEN_KEY must be 32 bytes, base64-encoded");
  return k;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
