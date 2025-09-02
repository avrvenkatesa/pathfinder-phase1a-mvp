import crossTab from "@/lib/crossTab";
import { queryClient } from "@/lib/queryClient";

/**
 * Register all cross-tab workflow handlers.
 * Call this once during client startup, BEFORE React mounts.
 */
export function registerWorkflowCrossTabHandlers() {
  // Debug every incoming event (optional)
  // crossTab.onAny((e) => console.debug("🔎 CrossTab any:", e));

  // When a contact changes in another tab, refresh relevant caches in this tab.
  crossTab.on(
    "contact:changed",
    (e) => {
      const id = (e as any).id as string | undefined;

      // invalidate list views
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "contacts"] });

      // invalidate detail views if we know which contact
      if (id) {
        queryClient.invalidateQueries({ queryKey: ["contact", id] });
        queryClient.i

