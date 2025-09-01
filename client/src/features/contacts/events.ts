import crossTab from "@/lib/crossTab";

export function emitContactChanged(payload: { id: string; summary?: any }) {
  console.log('📡 Emitting contact:changed event:', payload);
  // Do not process this event in the sender tab; only other tabs should react
  crossTab.emit("contact:changed", payload, { dispatchLocal: false });
}

export function emitContactDeleted(payload: { id: string; summary?: any }) {
  console.log('📡 Emitting contact:deleted event:', payload);
  // Do not process this event in the sender tab; only other tabs should react
  crossTab.emit("contact:deleted", payload, { dispatchLocal: false });
}