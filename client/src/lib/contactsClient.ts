// client/src/lib/contactsClient.ts
const etagCache = new Map<string, string>();

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
  if (!(res.status === 204 || res.ok)) throw new Error(`DELETE failed: ${res.status}`);

  etagCache.delete(id);
}