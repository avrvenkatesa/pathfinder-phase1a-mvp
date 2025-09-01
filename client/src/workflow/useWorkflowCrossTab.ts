import { useEffect } from "react";
import crossTab from "@/lib/crossTab";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useWorkflowCrossTab() {
  const { toast } = useToast();
  
  useEffect(() => {
    console.debug("🛠️ Registering workflow cross-tab handlers (route-scoped)");

    const off1 = crossTab.on(
      "contact:changed",
      ({ id, summary }) => {
        console.debug("📣 Workflow: Contact changed event received", { id, summary });

        // Refresh data the workflow UI relies on
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts/hierarchy"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
        
        if (id) {
          queryClient.invalidateQueries({ queryKey: ["/api/contacts", id] });
        }

        // Show a toast in workflow UI
        try {
          toast({
            title: "Contact Updated",
            description: `${summary?.name ?? "A contact"} was updated in another tab.`,
            variant: "default",
          });
        } catch (e) {
          console.error("Toast error:", e);
        }
      },
      { replayLast: true }
    );

    const off2 = crossTab.on(
      "contact:deleted",
      ({ id, summary }) => {
        console.debug("📣 Workflow: Contact deleted event received", { id, summary });

        // Refresh data the workflow UI relies on
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts/hierarchy"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
        
        if (id) {
          queryClient.removeQueries({ queryKey: ["/api/contacts", id] });
        }

        // Show a toast in workflow UI
        try {
          toast({
            title: "Contact Deleted",
            description: `${summary?.name ?? "A contact"} was deleted in another tab. This may affect workflow assignments.`,
            variant: "destructive",
          });
        } catch (e) {
          console.error("Toast error:", e);
        }
      },
      { replayLast: true }
    );

    return () => {
      console.debug("🛠️ Cleaning up workflow cross-tab handlers");
      off1();
      off2();
    };
  }, [toast]);
}