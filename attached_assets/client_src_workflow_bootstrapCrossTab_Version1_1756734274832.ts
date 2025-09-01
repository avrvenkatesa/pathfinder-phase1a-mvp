import crossTab from "@/lib/crossTab";
import { queryClient } from "@/lib/queryClient";

export function registerWorkflowCrossTabHandlers() {
  // Optional: debug everything coming in
  // crossTab.onAny((e) => console.debug("🔎 CrossTab any:", e));

  crossTab.on(
    "contact:changed",
    ({ id }) => {
      // Ensure your query keys match actual usage in your app
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-assignments"] });
      // If workflow UIs use per-contact queries:
      if (id) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts", id] });
        queryClient.invalidateQueries({ queryKey: ["/api/workflow-assignments", id] });
      }
    },
    { replayLast: true }
  );
}