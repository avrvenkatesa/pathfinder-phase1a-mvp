// client/src/lib/contactsClient.ts
import { emitContactChanged, emitContactDeleted } from "@/features/contacts/events";


const etagCache = new Map<string, string>();

export function getCachedETag(id: string) {
  return etagCache.get(id);
}

function saveETag(id: string, res: Response) {
  const etag = res.headers.get("ETag");
  if (etag) etagCache.set(id, etag);
}

export async function getContact(id: string) {
  const res = await fetch(`/api/contacts/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET contact failed: ${res.status}`);
  saveETag(id, res);
  return res.json();
}

export async function updateContact(id: string, patch: any) {
  const etag = etagCache.get(id);
  const res = await fetch(`/api/contacts/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(etag ? { "If-Match": etag } : {}), // include If-Match when we have it
    },
    body: JSON.stringify(patch),
  });

  if (res.status === 428) {
    // We never fetched (or lost) the ETag for this contact
    throw Object.assign(new Error("PRECONDITION_REQUIRED"), { code: 428 });
  }
  if (res.status === 412) {
    // Someone else changed it; capture the latest ETag so the UI can refetch/merge
    saveETag(id, res);
    throw Object.assign(new Error("ETAG_MISMATCH"), { code: 412 });
  }
  if (!res.ok) throw new Error(`PUT contact failed: ${res.status}`);

  saveETag(id, res);
  const updated = await res.json();

  // Announce to other tabs (ignore our own via origin in crossTab)
  emitContactChanged({ id, summary: { name: updated?.name, type: updated?.type } });
  return updated;
}

export async function checkContactCanDelete(id: string) {
  const res = await fetch(`/api/contacts/${id}/can-delete`, {
    credentials: "include"
  });
  if (!res.ok) throw new Error(`Check deletion failed: ${res.status}`);
  return res.json();
}

export async function deleteContact(id: string) {
  const etag = etagCache.get(id);
  const res = await fetch(`/api/contacts/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      ...(etag ? { "If-Match": etag } : {}),
    },
  });

  if (res.status === 428) throw Object.assign(new Error("PRECONDITION_REQUIRED"), { code: 428 });
  if (res.status === 412) {
    saveETag(id, res);
    throw Object.assign(new Error("ETAG_MISMATCH"), { code: 412 });
  }
  if (res.status === 409) {
    const errorData = await res.json();
    throw Object.assign(new Error(errorData.message), {
      code: 409,
      details: errorData.details,
      suggestions: errorData.suggestions
    });
  }
  if (!(res.status === 204 || res.ok)) throw new Error(`DELETE failed: ${res.status}`);

  // Announce deletion after success (contact info not available post-deletion)
  emitContactDeleted({ id, summary: { name: 'Deleted Contact', type: 'person' } });
  etagCache.delete(id);
}