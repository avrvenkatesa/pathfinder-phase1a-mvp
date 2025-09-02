// client/src/lib/crossTab.ts
// HMR-safe singleton BroadcastChannel bus with localStorage fallback + replayLast.

export type CrossTabEvent = {
  type: string;
  ts?: number;
  origin?: string;
  [k: string]: any; // payload keys
};

type Handler = (e: CrossTabEvent) => void;

const CHANNEL_NAME = "pf-x-tab";
const LAST_EVENT_KEY = "pf-x-tab:last";

function ensureTabId(): string {
  const k = "pf-tab-id";
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(k, id);
  }
  return id;
}

class CrossTabBus {
  private bc?: BroadcastChannel;
  private origin: string;
  private handlers = new Map<string, Set<Handler>>();
  private anyHandlers = new Set<Handler>();

  constructor() {
    this.origin = typeof window !== "undefined" ? ensureTabId() : "srv";

    if (typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel(CHANNEL_NAME);
      this.bc.onmessage = (msg: MessageEvent<CrossTabEvent>) => {
        const e = msg.data;
        if (!e) return;
        // ignore self (we already dispatch locally)
        if (e.origin === this.origin) return;
        this.dispatch(e);
      };
    } else if (typeof window !== "undefined") {
      // Fallback path: use storage events to deliver messages across tabs
      window.addEventListener("storage", (ev) => {
        if (ev.key !== LAST_EVENT_KEY || !ev.newValue) return;
        try {
          const e = JSON.parse(ev.newValue) as CrossTabEvent;
          if (e.origin === this.origin) return;
          this.dispatch(e);
        } catch {}
      });
    }
  }

  emit(type: string, payload: Record<string, any> = {}) {
    const e: CrossTabEvent = { type, ts: Date.now(), origin: this.origin, ...payload };
    // local dispatch first
    this.dispatch(e);
    // persist for replay
    try { localStorage.setItem(LAST_EVENT_KEY, JSON.stringify(e)); } catch {}
    // broadcast
    if (this.bc) {
      this.bc.postMessage(e);
    } else {
      try { localStorage.setItem(LAST_EVENT_KEY, JSON.stringify(e)); } catch {}
    }
  }

  on(type: string, handler: Handler, opts?: { replayLast?: boolean }) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);

    if (opts?.replayLast) {
      try {
        const raw = localStorage.getItem(LAST_EVENT_KEY);
        if (raw) {
          const last = JSON.parse(raw) as CrossTabEvent;
          if (last.type === type && last.origin !== this.origin) handler(last);
        }
      } catch {}
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
    this.handlers.get(e.type)?.forEach((h) => { try { h(e); } catch {} });
    this.anyHandlers.forEach((h) => { try { h(e); } catch {} });
  }
}

// --- HMR-safe singleton for Vite/React Fast Refresh ---
declare global {
  // eslint-disable-next-line no-var
  var __PF_XTAB__: CrossTabBus | undefined;
}
const crossTab: CrossTabBus = (globalThis as any).__PF_XTAB__ ?? new CrossTabBus();
(globalThis as any).__PF_XTAB__ = crossTab;

export default crossTab;
export { CHANNEL_NAME };
