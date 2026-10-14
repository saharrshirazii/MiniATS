import { useContext } from "react";

import { ActiveOrgContext } from "@/contexts/org-context";

export function useActiveOrg() {
  const context = useContext(ActiveOrgContext);
  if (!context) {
    throw new Error("useActiveOrg must be used inside <ActiveOrgProvider>");
  }
  return context;
}
