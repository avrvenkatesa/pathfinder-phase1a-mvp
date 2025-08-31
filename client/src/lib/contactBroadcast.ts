// client/src/lib/contactBroadcast.ts
type ContactEventType = "created" | "updated" | "deleted";

export type ContactEvent = {
  type: ContactEventType;
  contactId: string;
  etag?: string | null;
  at: number;
  origin: string;
};

const CHANNEL_NAME = "contacts";
const STORAGE_KEY = "__bc::contacts";
const ORIGIN =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Math.random()}`;

type Listener = (evt: ContactEvent) => void;

let bc: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

function publishViaStorage(evt: ContactEvent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evt));
    // cleanup quickly to avoid stale storage
    setTimeout(() => localStorage.removeItem(STORAGE_KEY), 0);
  } catch {}
}

function handleEvent(evt: ContactEvent) {
  if (evt.origin === ORIGIN) return; // ignore myself
  for (const l of listeners) l(evt);
}

function init() {
  if (typeof window === "undefined") return;

  if ("BroadcastChannel" in window) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (e) => {
      if (!e?.data) return;
      handleEvent(e.data as ContactEvent);
    };
  } else {
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const evt = JSON.parse(e.newValue) as ContactEvent;
        handleEvent(evt);
      } catch {}
    });
  }
}
init();

export function publishContactEvent(
  type: ContactEventType,
  contactId: string,
  etag?: string | null
) {
  const evt: ContactEvent = {
    type,
    contactId,
    etag: etag ?? null,
    at: Date.now(),
    origin: ORIGIN,
  };
  if (bc) bc.postMessage(evt);
  else publishViaStorage(evt);
}

export function subscribeContactEvents(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
