// client/src/lib/crossTab.ts
// A tiny cross-tab event bus for contact changes.

export type ContactChangedEvent = {
  type: "contact:changed";
  id: string;
  etag?: string;
  summary?: { name?: string; type?: string };
  origin: string;
  ts: number;
};

export type ContactDeletedEvent = {
  type: "contact:deleted";
  id: string;
  summary?: { name?: string; type?: string };
  origin: string;
  ts: number;
};

export type CrossTabEvent = ContactChangedEvent | ContactDeletedEvent;

const CHANNEL = "contacts-x-tab-v1";
const STORAGE_KEY = "__ct_event__";

const TAB_ID =
  sessionStorage.getItem("tabId") ||
  (() => {
    const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString();
    sessionStorage.setItem("tabId", id);
    return id;
  })();

let bc: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  bc = new BroadcastChannel(CHANNEL);
}

type Handler = (evt: CrossTabEvent) => void;
const handlers = new Set<Handler>();

function emit(evt: CrossTabEvent) {
  handlers.forEach((h) => {
    try {
      h(evt);
    } catch {}
  });
}

function onBCMessage(e: MessageEvent<CrossTabEvent>) {
  const evt = e.data;
  if (!evt || evt.origin === TAB_ID) return; // ignore self
  emit(evt);
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  try {
    const evt = JSON.parse(e.newValue) as CrossTabEvent;
    if (!evt || evt.origin === TAB_ID) return; // ignore self
    emit(evt);
  } catch {}
}

if (bc) bc.addEventListener("message", onBCMessage);
if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

export function subscribe(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function publish(evt: Omit<CrossTabEvent, "origin" | "ts">) {
  const full: CrossTabEvent = { ...evt, origin: TAB_ID, ts: Date.now() };
  if (bc) {
    bc.postMessage(full);
  } else {
    // localStorage fallback works across tabs in same origin
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    // write-then-remove to trigger 'storage' reliably
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Convenience helpers
export function announceContactChanged(id: string, etag?: string, summary?: { name?: string; type?: string }) {
  publish({ type: "contact:changed", id, summary });
}
export function announceContactDeleted(id: string, summary?: { name?: string; type?: string }) {
  publish({ type: "contact:deleted", id, summary });
}