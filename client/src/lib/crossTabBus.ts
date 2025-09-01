// client/src/lib/crossTabBus.ts
export type ChannelMessage =
  | { type: "contact:updated"; id: string }
  | { type: "contact:deleted"; id: string }
  | { type: "etag:set"; scope: "contact"; id: string; etag: string }
  | { type: "conflict"; id: string }; // someone hit a 412

const CHANNEL_NAME = "app-xTab";
const subs = new Set<(msg: ChannelMessage) => void>();

let chan: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    chan = new BroadcastChannel(CHANNEL_NAME);
    chan.onmessage = (ev) => {
      const msg = ev.data as ChannelMessage;
      subs.forEach((cb) => {
        try {
          cb(msg);
        } catch {}
      });
    };
  } catch {
    chan = null;
  }
}

export function post(msg: ChannelMessage) {
  try {
    chan?.postMessage(msg);
  } catch {}
  // also deliver locally so the sender gets it too (and for no-BC fallback)
  subs.forEach((cb) => {
    try {
      cb(msg);
    } catch {}
  });
}

export function subscribe(cb: (msg: ChannelMessage) => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}