/**
 * QR checkpoint payloads.
 *
 * A printed QR encodes ONLY an opaque random token, wrapped in a URL so that a
 * phone's stock camera opens the web app:  https://<host>/q/<token>
 * The native app also accepts  campusnav://q/<token>.
 *
 * The token carries no location, tenant or permission data. It must always be
 * resolved against the backend, which decides whether it is active.
 */

export const TOKEN_PATTERN = /^[A-Za-z0-9]{16,64}$/;

export type ParsedCheckpoint = { ok: true; token: string } | { ok: false; reason: "empty" | "too_long" | "unrecognized" | "bad_token" };

const MAX_PAYLOAD = 512;

export function parseCheckpointPayload(raw: string, allowedHosts?: string[]): ParsedCheckpoint {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "empty" };
  if (value.length > MAX_PAYLOAD) return { ok: false, reason: "too_long" };

  let candidate: string | null = null;
  if (value.startsWith("campusnav://")) {
    const m = /^campusnav:\/\/q\/([^/?#]+)\/?$/.exec(value);
    candidate = m?.[1] ?? null;
  } else if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return { ok: false, reason: "unrecognized" };
    }
    if (allowedHosts && allowedHosts.length && !allowedHosts.includes(url.host)) return { ok: false, reason: "unrecognized" };
    const m = /^\/q\/([^/]+)\/?$/.exec(url.pathname);
    candidate = m?.[1] ?? null;
  } else if (TOKEN_PATTERN.test(value)) {
    // Manually typed code printed under the QR.
    candidate = value;
  }
  if (candidate == null) return { ok: false, reason: "unrecognized" };
  if (!TOKEN_PATTERN.test(candidate)) return { ok: false, reason: "bad_token" };
  return { ok: true, token: candidate };
}

export function checkpointUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/q/${token}`;
}

/** Cryptographically random token using Web Crypto (available in browsers, Node ≥ 19, Deno, RN with polyfill). */
export function generateCheckpointToken(length = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  // Rejection sampling avoids modulo bias.
  const limit = 256 - (256 % alphabet.length);
  let i = 0;
  while (out.length < length) {
    if (i >= bytes.length) {
      globalThis.crypto.getRandomValues(bytes);
      i = 0;
    }
    const b = bytes[i++]!;
    if (b < limit) out += alphabet[b % alphabet.length];
  }
  return out;
}

export type CheckpointResolution =
  | { status: "ok"; checkpoint: { id: string; universityId: string; nodeId: string; label: import("../model/types").LocalizedText } }
  | { status: "unknown" }
  | { status: "disabled" }
  | { status: "expired" }
  | { status: "wrong_university"; universityId: string }
  | { status: "rate_limited" }
  | { status: "network_error" };

/** Evaluate a checkpoint record fetched from the backend. */
export function evaluateCheckpoint(
  record: { id: string; universityId: string; nodeId: string; label: import("../model/types").LocalizedText; status: "active" | "disabled"; expiresAt?: string | null } | null,
  now: Date,
  activeUniversityId?: string,
): CheckpointResolution {
  if (!record) return { status: "unknown" };
  if (record.status !== "active") return { status: "disabled" };
  if (record.expiresAt && Date.parse(record.expiresAt) <= now.getTime()) return { status: "expired" };
  if (activeUniversityId && record.universityId !== activeUniversityId) return { status: "wrong_university", universityId: record.universityId };
  return { status: "ok", checkpoint: { id: record.id, universityId: record.universityId, nodeId: record.nodeId, label: record.label } };
}
