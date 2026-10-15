import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useCvSignedUrl } from "@/hooks/useCandidates";

/**
 * Opens a candidate's stored CV in a new tab via a freshly minted signed
 * URL (the "cvs" bucket is private, so there is no permanent link to show).
 * The tab is opened synchronously on click, before the URL comes back, so
 * browsers don't treat it as an unrequested popup.
 */
export function CvLink({ path }: { path: string }) {
  const getSignedUrl = useCvSignedUrl();

  return (
    <button
      type="button"
      disabled={getSignedUrl.isPending}
      onClick={(e) => {
        e.stopPropagation();
        const tab = window.open("", "_blank");
        getSignedUrl.mutate(path, {
          onSuccess: (url) => {
            if (tab) tab.location.href = url;
          },
          onError: (error) => {
            tab?.close();
            toast.error("Could not open the CV", { description: error.message });
          },
        });
      }}
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50"
    >
      {getSignedUrl.isPending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <FileText className="size-3" />
      )}
      CV
    </button>
  );
}
