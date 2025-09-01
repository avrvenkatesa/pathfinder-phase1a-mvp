import crossTab from "@/lib/crossTab";

export function emitContactChanged(payload: { id: string; summary?: any }) {
  console.log('📡 Emitting contact:changed event:', payload);
  crossTab.emit("contact:changed", payload);
}

export function emitContactDeleted(payload: { id: string; summary?: any }) {
  console.log('📡 Emitting contact:deleted event:', payload);
  crossTab.emit("contact:deleted", payload);
}