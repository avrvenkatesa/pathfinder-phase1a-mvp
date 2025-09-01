// client/src/lib/concurrencyApi.ts
export type Contact = any; // replace with your real Contact type if available

export class StaleError extends Error {
  currentETag?: string | null;
  constructor(message: string, currentETag?: string | null) {
    super(message);
    this.name = "StaleError";
    this.currentETag = currentETag ?? null;
  }
}

function extractETag(res: Response) {
  return res.headers.get("etag");
}

export async function getContact(id: string) {
  const res = await fetch(`/api/contacts/${id}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to load contact: ${res.status}`);
  }
  const etag = extractETag(res);
  const data = (await res.json()) as Contact;
  return { data, etag };
}

export async function updateContact(
  id: string,
  patch: Partial<Contact>,
  etag: string
) {
  const res = await fetch(`/api/contacts/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "If-Match": etag,
    },
    body: JSON.stringify(patch),
  });

  if (res.status === 412) {
    const body = await res.json().catch(() => ({}));
    throw new StaleError("ETag mismatch", body.currentETag);
  }
  if (res.status === 428) {
    throw new Error("Missing If-Match header");
  }
  if (!res.ok) {
    throw new Error(`Update failed: ${res.status}`);
  }

  const newETag = res.headers.get("etag");
  const data = (await res.json()) as Contact;
  return { data, etag: newETag };
}

export async function deleteContact(id: string, etag: string) {
  const res = await fetch(`/api/contacts/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "If-Match": etag,
    },
  });

  if (res.status === 412) {
    const body = await res.json().catch(() => ({}));
    throw new StaleError("ETag mismatch", body.currentETag);
  }
  if (res.status === 428) {
    throw new Error("Missing If-Match header");
  }
  if (res.status !== 204) {
    throw new Error(`Delete failed: ${res.status}`);
  }
}
