import React from "react";
import { subscribe, type CrossTabEvent } from "@/lib/crossTab";

type ContactInfo = { name?: string; type?: string };

type Props = {
  // The contacts currently referenced by this workflow (tasks, assignees, etc.)
  contactIds: string[];

  // Optional name/type map so we can show friendlier text
  contactLookup?: Record<string, ContactInfo>;

  // Optional hooks so the workflow page can react programmatically
  onAnyContactChanged?: (ids: string[]) => void;
  onAnyContactDeleted?: (ids: string[]) => void;

  // If you have a reload action for the workflow view
  onReloadWorkflow?: () => void;
};

export default function WorkflowCrossTabBanner({
  contactIds,
  contactLookup = {},
  onAnyContactChanged,
  onAnyContactDeleted,
  onReloadWorkflow,
}: Props) {
  const contactSet = React.useMemo(() => new Set(contactIds), [contactIds]);

  const [changedIds, setChangedIds] = React.useState<string[]>([]);
  const [deletedIds, setDeletedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    return subscribe((evt: CrossTabEvent) => {
      if (evt.type === "contact:changed" && contactSet.has(evt.id)) {
        setChangedIds((prev) => (prev.includes(evt.id) ? prev : [...prev, evt.id]));
      }
      if (evt.type === "contact:deleted" && contactSet.has(evt.id)) {
        setDeletedIds((prev) => (prev.includes(evt.id) ? prev : [...prev, evt.id]));
      }
    });
  }, [contactSet]);

  React.useEffect(() => {
    if (changedIds.length) onAnyContactChanged?.(changedIds);
  }, [changedIds, onAnyContactChanged]);

  React.useEffect(() => {
    if (deletedIds.length) onAnyContactDeleted?.(deletedIds);
  }, [deletedIds, onAnyContactDeleted]);

  if (!changedIds.length && !deletedIds.length) return null;

  const listNames = (ids: string[]) =>
    ids
      .map((id) => contactLookup[id]?.name || id)
      .slice(0, 3)
      .join(", ") + (ids.length > 3 ? ` +${ids.length - 3} more` : "");

  return (
    <div className="w-full mb-3 space-y-2">
      {deletedIds.length > 0 && (
        <div className="w-full p-3 rounded-md bg-red-100 text-red-800 border border-red-200 flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">Assignments invalid</div>
            <div className="text-sm">
              The following assigned contact{deletedIds.length > 1 ? "s were" : " was"}{" "}
              <strong>deleted in another tab</strong>: {listNames(deletedIds)}.
              Review the affected tasks and pick new assignees.
            </div>
          </div>
          <div className="flex gap-2">
            {onReloadWorkflow && (
              <button
                className="px-3 py-1 rounded bg-red-200 hover:bg-red-300"
                onClick={() => onReloadWorkflow()}
              >
                Reload
              </button>
            )}
            <button
              className="px-3 py-1 rounded border border-red-300 hover:bg-red-50"
              onClick={() => setDeletedIds([])}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {changedIds.length > 0 && (
        <div className="w-full p-3 rounded-md bg-amber-100 text-amber-900 border border-amber-200 flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">Assignee data changed</div>
            <div className="text-sm">
              The following assigned contact{changedIds.length > 1 ? "s" : ""}{" "}
              <strong>changed in another tab</strong>: {listNames(changedIds)}.
              Consider re-validating task requirements before proceeding.
            </div>
          </div>
          <div className="flex gap-2">
            {onReloadWorkflow && (
              <button
                className="px-3 py-1 rounded bg-amber-200 hover:bg-amber-300"
                onClick={() => onReloadWorkflow()}
              >
                Reload
              </button>
            )}
            <button
              className="px-3 py-1 rounded border border-amber-300 hover:bg-amber-50"
              onClick={() => setChangedIds([])}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}