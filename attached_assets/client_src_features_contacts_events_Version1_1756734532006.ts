import crossTab from "@/lib/crossTab";

export function emitContactChanged(payload: { id: string; summary?: any }) {
  crossTab.emit("contact:changed", payload);
}