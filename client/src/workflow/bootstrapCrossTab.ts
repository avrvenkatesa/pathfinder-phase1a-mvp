import crossTab from "@/lib/crossTab";
import { queryClient } from "@/lib/queryClient";

export function registerWorkflowCrossTabHandlers() {
  console.log('🚀 Registering workflow cross-tab handlers at app bootstrap');
  
  // Optional: debug everything coming in
  // crossTab.onAny((e) => console.debug("🔎 CrossTab any:", e));

  crossTab.on(
    "contact:changed",
    ({ id, summary }) => {
      console.log('📞 Workflow: Contact changed event received:', { id, summary });
      
      // Ensure your query keys match actual usage in your app
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      
      // If workflow UIs use per-contact queries:
      if (id) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts", id] });
      }
    },
    { replayLast: true }
  );

  crossTab.on(
    "contact:deleted",
    ({ id, summary }) => {
      console.log('🗑️ Workflow: Contact deleted event received:', { id, summary });
      
      // Invalidate queries for deleted contact
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      
      if (id) {
        queryClient.removeQueries({ queryKey: ["/api/contacts", id] });
      }
    },
    { replayLast: true }
  );
  
  console.log('✅ Workflow cross-tab handlers registered successfully');
}