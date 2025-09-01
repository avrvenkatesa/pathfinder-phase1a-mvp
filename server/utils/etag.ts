import { createHash } from "node:crypto";

const quote = (v: string) => `"${v}"`;

export function computeContactETag(contact: { id: string; updatedAt?: Date | string | null }) {
  const ts = contact?.updatedAt ? new Date(contact.updatedAt as any).getTime() : 0;
  const raw = `${contact.id}:${ts}`;
  const hash = createHash("sha1").update(raw).digest("base64url");
  return quote(hash);
}

function normalize(etag: string) {
  return etag.replace(/^W\//, "").replace(/^"+|"+$/g, "");
}

export function ifMatchSatisfied(ifMatchHeader: string | null | undefined, currentETag: string) {
  if (!ifMatchHeader) return false;
  if (ifMatchHeader.trim() === "*") return true;
  const cur = normalize(currentETag);
  return ifMatchHeader
    .split(",")
    .map((t) => normalize(t.trim()))
    .some((t) => t === cur);
}
