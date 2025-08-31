// client/src/components/ContactEditorConcurrencyDemo.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getContact,
  updateContact,
  deleteContact,
  StaleError,
} from "../lib/concurrencyApi";
import {
  publishContactEvent,
  subscribeContactEvents,
  ContactEvent,
} from "../lib/contactBroadcast";

type Props = { contactId: string };

export default function ContactEditorConcurrencyDemo({ contactId }: Props) {
  const mounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [etag, setETag] = useState<string | null>(null);
  const [contact, setContact] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [staleNotice, setStaleNotice] = useState<null | {
    type: "updated" | "deleted";
    from: "broadcast" | "server";
    currentETag?: string | null;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, etag } = await getContact(contactId);
      if (!mounted.current) return;
      setContact(data);
      setName(data?.name ?? "");
      setETag(etag);
      setStaleNotice(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    load();
    const unsub = subscribeContactEvents((evt: ContactEvent) => {
      if (evt.contactId !== contactId) return;
      if (evt.type === "deleted") {
        setStaleNotice({ type: "deleted", from: "broadcast" });
      } else if (evt.type === "updated") {
        // Someone else updated; mark as stale until we refresh
        setStaleNotice({ type: "updated", from: "broadcast", currentETag: evt.etag });
      }
    });
    return () => {
      mounted.current = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  async function onSave() {
    if (!etag) {
      setError("No ETag loaded yet");
      return;
    }
    setError(null);
    try {
      const { data, etag: newETag } = await updateContact(contactId, { name }, etag);
      setContact(data);
      setETag(newETag || null);
      setStaleNotice(null);
      publishContactEvent("updated", contactId, newETag || null);
    } catch (e) {
      if (e instanceof StaleError) {
        setStaleNotice({
          type: "updated",
          from: "server",
          currentETag: e.currentETag,
        });
      } else {
        setError((e as any)?.message ?? String(e));
      }
    }
  }

  async function onDelete() {
    if (!etag) {
      setError("No ETag loaded yet");
      return;
    }
    setError(null);
    try {
      await deleteContact(contactId, etag);
      publishContactEvent("deleted", contactId);
      setStaleNotice({ type: "deleted", from: "server" });
    } catch (e) {
      if (e instanceof StaleError) {
        setStaleNotice({
          type: "updated", // someone changed it; treat as stale edit
          from: "server",
          currentETag: e.currentETag,
        });
      } else {
        setError((e as any)?.message ?? String(e));
      }
    }
  }

  if (loading) return <div className="p-4">Loading…</div>;
  if (staleNotice?.type === "deleted") {
    return (
      <div className="p-4 space-y-3">
        <div className="bg-red-50 border border-red-200 p-3 rounded">
          <b>Gone:</b> This contact was deleted in another tab.
        </div>
        <button className="px-3 py-2 rounded bg-gray-900 text-white" onClick={load}>
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-xl space-y-3">
      {staleNotice && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
          <b>Out of date:</b>{" "}
          {staleNotice.from === "broadcast"
            ? "Updated in another tab."
            : "Your copy is stale (server rejected your edit)."}
          {"  "}
          <button
            className="underline ml-2"
            onClick={() => load()}
            title="Reload latest"
          >
            Reload latest
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-3 rounded">{error}</div>
      )}

      <div className="text-xs text-gray-500">ETag: {etag ?? "—"}</div>

      <label className="block text-sm font-medium">Name</label>
      <input
        className="border rounded px-2 py-1 w-full"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex gap-2 pt-2">
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={onSave}
        >
          Save
        </button>
        <button
          className="px-3 py-2 rounded bg-red-600 text-white"
          onClick={onDelete}
        >
          Delete
        </button>
        <button className="px-3 py-2 rounded bg-gray-200" onClick={load}>
          Reload
        </button>
      </div>
    </div>
  );
}
