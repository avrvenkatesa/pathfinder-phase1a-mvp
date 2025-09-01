// client/src/components/ContactCrossTabBanner.tsx
import React from "react";
import { subscribe, CrossTabEvent } from "@/lib/crossTab";
import { getContact } from "@/lib/contactsClient";

type Props = {
  contactId: string;
  onReload?: (fresh: any) => void;  // pass fresh data to parent form if you like
  onDeleted?: () => void;           // let parent disable the editor if deleted
};

export default function ContactCrossTabBanner({ contactId, onReload, onDeleted }: Props) {
  const [changed, setChanged] = React.useState<null | { when: Date }>(null);
  const [deleted, setDeleted] = React.useState(false);

  React.useEffect(() => {
    return subscribe((evt: CrossTabEvent) => {
      if (evt.type === "contact:changed" && evt.id === contactId) {
        setChanged({ when: new Date() });
      }
      if (evt.type === "contact:deleted" && evt.id === contactId) {
        setDeleted(true);
        onDeleted?.();
      }
    });
  }, [contactId, onDeleted]);

  if (deleted) {
    return (
      <div className="w-full p-3 rounded-md bg-red-100 text-red-800 mb-3 border border-red-200">
        This contact was <strong>deleted in another tab</strong>. The form is now read-only.
      </div>
    );
  }

  if (changed) {
    return (
      <div className="w-full p-3 rounded-md bg-amber-100 text-amber-900 mb-3 border border-amber-200 flex items-center justify-between gap-3">
        <div>
          This contact was <strong>updated in another tab</strong>. Reload to get the latest before saving.
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded bg-amber-200 hover:bg-amber-300"
            onClick={async () => {
              try {
                const fresh = await getContact(contactId);
                onReload?.(fresh);
                setChanged(null);
              } catch {
                // no-op: let parent show a toast if desired
              }
            }}
          >
            Reload
          </button>
          <button
            className="px-3 py-1 rounded border border-amber-300 hover:bg-amber-50"
            onClick={() => setChanged(null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}