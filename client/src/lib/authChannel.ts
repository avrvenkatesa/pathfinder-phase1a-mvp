// Tiny helper to broadcast auth events across tabs
let ch: BroadcastChannel | null = null;

export function broadcastLogout() {
  try {
    ch = ch || new BroadcastChannel("auth");
    ch.postMessage({ type: "logout" });
  } catch {}
  // Fallback for older browsers
  try {
    localStorage.setItem(
      "auth:broadcast",
      JSON.stringify({ type: "logout", t: Date.now() }),
    );
  } catch {}
}

export function onAuthBroadcast(cb: () => void) {
  try {
    ch = ch || new BroadcastChannel("auth");
    ch.onmessage = () => cb();
  } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key === "auth:broadcast") cb();
  });
}
