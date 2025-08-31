// client/src/components/CrossTabAlerts.tsx
import React, { useEffect, useState } from "react";
import { subscribe, ChannelMessage } from "../lib/crossTabBus";

export default function CrossTabAlerts() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const off = subscribe((m: ChannelMessage) => {
      let newMsg: string | null = null;
      if (m.type === "contact:updated") {
        newMsg = "This contact was updated in another tab. Refresh to see the latest.";
      } else if (m.type === "contact:deleted") {
        newMsg = "This contact was deleted in another tab.";
      } else if (m.type === "conflict") {
        newMsg = "Your copy is stale. Reload before saving again.";
      }
      
      if (newMsg) {
        setMsg(newMsg);
        // auto-clear after 6 seconds
        setTimeout(() => setMsg(null), 6000);
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!msg) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#111",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 10,
        boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
        zIndex: 9999,
        fontSize: 14,
      }}
    >
      {msg}
    </div>
  );
}