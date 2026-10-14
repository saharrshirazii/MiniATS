import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useOrganizations } from "@/hooks/useOrganizations";

import { ActiveOrgContext, type ActiveOrgContextValue } from "./org-context";

const storageKey = (userId: string) => `miniats.actingAs.${userId}`;

// localStorage can throw (private mode, blocked storage) — the selector
// still works for the session, it just isn't remembered.
function readStored(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function writeStored(userId: string | undefined, orgId: string) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), orgId);
  } catch {
    /* ignore */
  }
}

/**
 * Decides which organization the app works on.
 * Admins act on behalf of a selected organization (remembered per browser);
 * customers are fixed to their own. RLS still enforces access in the database —
 * this only scopes what the UI shows and where new rows go.
 */
export function ActiveOrgProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin } = useAuth();
  const { data: organizations = [], isPending } = useOrganizations();
  const [selectedId, setSelectedId] = useState<string | null>(() => readStored(user?.id));

  const setActiveOrgId = useCallback(
    (id: string) => {
      setSelectedId(id);
      writeStored(user?.id, id);
    },
    [user?.id],
  );

  const value = useMemo<ActiveOrgContextValue>(() => {
    let activeOrgId: string | null;
    if (isAdmin) {
      // Fall back to the first organization if nothing is selected yet,
      // or the remembered one was deleted.
      const stillExists = organizations.some((o) => o.id === selectedId);
      activeOrgId = stillExists ? selectedId : (organizations[0]?.id ?? null);
    } else {
      activeOrgId = profile?.organization_id ?? null;
    }

    return {
      activeOrgId,
      activeOrgName: organizations.find((o) => o.id === activeOrgId)?.name ?? null,
      canSwitch: isAdmin,
      setActiveOrgId,
      loading: isPending,
    };
  }, [isAdmin, organizations, selectedId, profile?.organization_id, setActiveOrgId, isPending]);

  return <ActiveOrgContext.Provider value={value}>{children}</ActiveOrgContext.Provider>;
}
