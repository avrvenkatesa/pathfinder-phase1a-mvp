// client/src/workflow/bootstrapCrossTab.ts
import crossTab from "@/lib/crossTab";
import { queryClient } from "@/lib/queryClient";

/**
 * Register all cross-tab workflow handlers.
 * Call this once during client startup, BEFORE React mounts.
 */
export function registerWorkflowCrossTabHandlers() {
  // Optional: debug every incoming event
  crossTab.onAny((e) => console.debug("🔎 CrossTab event:", e));

  // ---- contact:changed ------------------------------------------------------
  // When a contact is created/updated in another tab, refresh relevant caches.
  crossTab.on(
    "contact:changed",
    (e) => {
      const id = (e as any).id as string | undefined;

      // Invalidate list views
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "contacts"] });

      // Invalidate detail if we know which contact
      if (id) {
        queryClient.invalidateQueries({ queryKey: ["contact", id] });
        queryClient.invalidateQueries({ queryKey: ["workflow", "contact", id] });
      }
    },
    { replayLast: true }
  );

  // ---- contact:deleted ------------------------------------------------------
  // When a contact is deleted in another tab, refresh lists and drop detail caches.
  crossTab.on(
    "contact:deleted",
    (e) => {
      const id = (e as any).id as string | undefined;

      // Refresh lists that could include the deleted contact
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "contacts"] });

      // Remove any cached detail for that contact
      if (id) {
        queryClient.removeQueries({ queryKey: ["contact", id], exact: true });
        queryClient.removeQueries({ queryKey: ["workflow", "contact", id], exact: true });
      }
    },
    { replayLast: true }
  );
}
