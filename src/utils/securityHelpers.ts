// src/utils/securityHelpers.ts
import crypto from "crypto";
import type { Context } from "hono";

/**
 * Constant-time string comparison using SHA-256 digests so string length never leaks timing info.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Verifies GOWA / GitHub-style HMAC-SHA256 webhook signature (`sha256=<hex>` or `<hex>`).
 */
export function verifyHmacSha256Signature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const provided = signatureHeader.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex")
  );
}

/**
 * Validates path segment parameters (e.g. GOWA device IDs) to prevent path traversal / SSRF.
 */
export function isSafePathSegment(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}

/**
 * Extracts client IP defensively behind reverse proxies (Cloudflare / Caddy / Nginx).
 * Uses rightmost X-Forwarded-For entry (added by trusted proxy) if CF/X-Real-IP absent.
 */
export function extractClientIp(c: Context): string {
  const cfIp = c.req.header("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const realIp = c.req.header("x-real-ip")?.trim();
  if (realIp) return realIp;

  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  return (c.env as any)?.REMOTE_ADDR || "anonymous";
}

/**
 * Clamps pagination `limit` query parameter safely between [1, maxLimit].
 */
export function clampLimit(
  raw: string | undefined,
  defaultLimit: number = 20,
  maxLimit: number = 100
): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

/**
 * Validates WhatsApp recipient format (international phone digits or valid WA JID).
 */
export function isValidWhatsAppRecipient(raw: string): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (/^[0-9]{8,20}@(s\.whatsapp\.net|g\.us)$/.test(trimmed)) return true;
  const digits = trimmed.replace(/[\s+-]/g, "");
  return /^(08|62)[0-9]{7,15}$/.test(digits);
}
