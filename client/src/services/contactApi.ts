// client/src/services/contactApi.ts
import { ETagStore } from "../lib/etagStore";
import { post as postBus } from "../lib/crossTabBus";

export class MissingIfMatchError extends Error {
  constructor() {
    super("Missing If-Match header");
    this.name = "MissingIfMatchError";
  }
}

export class PreconditionFailedError extends Error {
  currentETag?: string;
  constructor(currentETag?: string) {
    super("ETag precondition failed");
    this.name = "PreconditionFailedError";
    this.currentETag = currentETag;
  }
}

function withCreds(init?: RequestInit): RequestInit {
  return { credentials: "include", ...(init || {}) };
}

export async function getContact(id: string) {
  const res = await fetch(`/api/contacts/${id}`, withCreds());
  if (res.status === 404) throw new Error("Not found");
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  const etag = res.headers.get("etag");
  if (etag) {
    ETagStore.set("contact", id, etag);
    postBus({ type: "etag:set", scope: "contact", id, etag });
  }
  return res.json();
}

export async function updateContact(id: string, data: any) {
  const etag = ETagStore.get("contact", id);
  const res = await fetch(
    `/api/contacts/${id}`,
    withCreds({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "If-Match": etag ?? "",
      },
      body: JSON.stringify(data),
    })
  );

  if (res.status === 428) throw new MissingIfMatchError();

  if (res.status === 412) {
    let currentETag: string | undefined;
    try {
      const j = await res.json();
      currentETag = j?.currentETag;
      if (currentETag) {
        ETagStore.set("contact", id, currentETag);
        postBus({ type: "etag:set", scope: "contact", id, etag: currentETag });
      }
    } catch {}
    postBus({ type: "conflict", id });
    throw new PreconditionFailedError(currentETag);
  }

  if (!res.ok) throw new Error(`PUT failed: ${res.status}`);

  const json = await res.json();
  const newETag = res.headers.get("etag");
  if (newETag) {
    ETagStore.set("contact", id, newETag);
    postBus({ type: "etag:set", scope: "contact", id, etag: newETag });
  }
  postBus({ type: "contact:updated", id });
  return json;
}

export async function deleteContact(id: string) {
  const etag = ETagStore.get("contact", id);
  const res = await fetch(
    `/api/contacts/${id}`,
    withCreds({
      method: "DELETE",
      headers: {
        "If-Match": etag ?? "",
      },
    })
  );

  if (res.status === 428) throw new MissingIfMatchError();

  if (res.status === 412) {
    let currentETag: string | undefined;
    try {
      const j = await res.json();
      currentETag = j?.currentETag;
      if (currentETag) {
        ETagStore.set("contact", id, currentETag);
        postBus({ type: "etag:set", scope: "contact", id, etag: currentETag });
      }
    } catch {}
    postBus({ type: "conflict", id });
    throw new PreconditionFailedError(currentETag);
  }

  if (res.status === 204) {
    ETagStore.remove("contact", id);
    postBus({ type: "contact:deleted", id });
    return;
  }

  if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
}