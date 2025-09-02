// client/src/workflow/bootstrapCrossTab.ts
import crossTab from "@/lib/crossTab";
import { queryClient } from "@/lib/queryClient";

// Prevent double-registration during HMR / multiple mounts
declare global {
  // eslint-disable-next-line no-var
  var __PF_XTAB_BOOT__: boolean | undefined;
}

export function registerWorkflowCrossTabHandlers() {
  if (globalThis.__PF_XTAB_BOOT__) return;
  globalThis.__PF_XTAB_BOOT__ = true;

  // --- debug: prove we actually registered
  console.log("[bootstrapCrossTab] registering handlers");
  crossTab.onAny((e) => console.debug("🔎 CrossTab event:", e));

  // ---- contact:changed ------------------------------------------------------
  crossTab.on(
    "contact:changed",
    (e) => {
      const id = (e as any).id as string | undefined;
      const summary = (e as any).summary;

      // (optional) optimistic cache touch so you see changes even if API is down
      if (id && summary) {
        queryClient.setQueryData(["contact", id], (prev: any) => ({ ...prev, ...summary }));
        queryClient.setQueryData(["contacts"], (list: any[] | undefined) =>
          Array.isArray(list) ? list.map((c) => (c.id === id ? { ...c, ...summary } : c)) : list
        );
      }

      // normal refetch
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ["contact", id] });
      }
      // keep these if you use them elsewhere
      queryClient.invalidateQueries({ queryKey: ["workflow", "contacts"] });
      if (id) queryClient.invalidateQueries({ queryKey: ["workflow", "contact", id] });
    },
    { replayLast: true }
  );

  // ---- contact:deleted ------------------------------------------------------
  crossTab.on(
    "contact:deleted",
    (e) => {
      const id = (e as any).id as string | undefined;

      // refresh lists
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "contacts"] });

      // drop cached detail
      if (id) {
        queryClient.removeQueries({ queryKey: ["contact", id], exact: true });
        queryClient.removeQueries({ queryKey: ["workflow", "contact", id], exact: true });
      }
    },
    { replayLast: true }
  );
}
