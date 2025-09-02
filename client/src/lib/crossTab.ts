// client/src/lib/crossTab.ts
// Cross-tab bus using BroadcastChannel + storage-event + polling fallback (with dedupe).
// HMR-safe singleton.

export type CrossTabEvent = {
  type: string;
  ts?: number;
  origin?: string;
  eid?: string;            // unique event id (for dedupe)
  [k: string]: any;        // payload
};

type Handler = (e: CrossTabEvent) => void;

const CHANNEL_NAME = "pf-x-tab";
const LAST_EVENT_KEY = "pf-x-tab:last";

declare global {
  // eslint-disable-next-line no-var
  var __PF_TAB_ID__: string | undefined;
  // eslint-disable-next-line no-var
  var __PF_XTAB__: CrossTabBus | undefined;
}

function getTabId(): string {
  if (!globalThis.__PF_TAB_ID__) {
    const rid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    globalThis.__PF_TAB_ID__ = rid;
  }
  return globalThis.__PF_TAB_ID__;
}

class CrossTabBus {
  private bc?: BroadcastChannel;
  private origin: string;
  private handlers = new Map<string, Set<Handler>>();
  private anyHandlers = new Set<Handler>();
  private seen = new Set<string>(); // eid dedupe

  constructor() {
    this.origin = typeof window !== "undefined" ? getTabId() : "srv";

    // Transport 1: BroadcastChannel
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.bc = new BroadcastChannel(CHANNEL_NAME);
        this.bc.onmessage = (msg: MessageEvent<CrossTabEvent>) => {
          this.handleIncoming(msg.data);
        };
      } catch { }
    }

    // Transport 2: storage event
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (ev) => {
        if (ev.key !== LAST_EVENT_KEY || !ev.newValue) return;
        try {
          const e = JSON.parse(ev.newValue) as CrossTabEvent;
          this.handleIncoming(e);
        } catch { }
      });

      // Transport 3: polling fallback (covers cases where 'storage' doesn't fire)
      let lastPolledEid = "";
      setInterval(() => {
        try {
          const raw = localStorage.getItem(LAST_EVENT_KEY);
          if (!raw) return;
          const e = JSON.parse(raw) as CrossTabEvent;
          if (!e?.eid || e.eid === lastPolledEid) return;
          lastPolledEid = e.eid;
          this.handleIncoming(e);
        } catch { }
      }, 800);
    }
  }

  private handleIncoming(e?: CrossTabEvent) {
    if (!e) return;
    if (e.origin === this.origin) return;        // ignore self
    if (e.eid && this.seen.has(e.eid)) return;   // dedupe
    if (e.eid) this.seen.add(e.eid);
    this.dispatch(e);
  }

  emit(
    type: string,
    payload: Record<string, any> = {},
    opts?: { dispatchLocal?: boolean }
  ) {
    const { dispatchLocal = true } = opts ?? {};
    const e: CrossTabEvent = {
      type,
      ts: Date.now(),
      origin: this.origin,
      eid: `${type}:${Math.random().toString(36).slice(2, 8)}:${Date.now()}`,
      ...payload,
    };

    // optionally dispatch locally
    if (dispatchLocal) this.dispatch(e);

    // persist for storage/poll transports & late-subscriber replay
    try {
      localStorage.setItem(LAST_EVENT_KEY, JSON.stringify(e));
    } catch { }

    // BroadcastChannel (best-effort)
    try {
      this.bc?.postMessage(e);
    } catch { }
  }

  on(type: string, handler: Handler, opts?: { replayLast?: boolean }) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);

    if (opts?.replayLast) {
      try {
        const raw = localStorage.getItem(LAST_EVENT_KEY);
        if (raw) {
          const last = JSON.parse(raw) as CrossTabEvent;
          if (last.type === type && last.origin !== this.origin) {
            if (!last.eid || !this.seen.has(last.eid)) {
              if (last.eid) this.seen.add(last.eid);
              handler(last);
            }
          }
        }
      } catch { }
    }
    return () => this.off(type, handler);
  }

  onAny(handler: Handler) {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  off(type: string, handler: Handler) {
    this.handlers.get(type)?.delete(handler);
  }

  private dispatch(e: CrossTabEvent) {
    this.handlers.get(e.type)?.forEach((h) => { try { h(e); } catch { } });
    this.anyHandlers.forEach((h) => { try { h(e); } catch { } });
  }
}

// HMR-safe singleton
const crossTab: CrossTabBus = globalThis.__PF_XTAB__ ?? new CrossTabBus();
globalThis.__PF_XTAB__ = crossTab;

export default crossTab;
export { CHANNEL_NAME };
