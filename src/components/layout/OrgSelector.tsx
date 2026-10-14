import { Building2 } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { ALL_ORGS } from "@/contexts/org-context";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrganizations } from "@/hooks/useOrganizations";

/**
 * Admins: "Organization" dropdown — "All", or one organization to work on its behalf.
 * Customers: their organization's name (read-only).
 */
export function OrgSelector() {
  const { activeOrgId, activeOrgName, isAll, canSwitch, setActiveOrgId } =
    useActiveOrg();
  const { data: organizations = [] } = useOrganizations();

  if (!canSwitch) {
    return activeOrgName ? (
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{activeOrgName}</span>
      </div>
    ) : null;
  }

  if (organizations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No organizations yet</p>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label
        htmlFor="org-selector"
        className="hidden shrink-0 text-sm text-muted-foreground sm:block"
      >
        Organization
      </label>
      <div className="w-48 sm:w-56">
        <NativeSelect
          id="org-selector"
          aria-label="Organization"
          value={isAll ? ALL_ORGS : (activeOrgId ?? ALL_ORGS)}
          onChange={(e) => setActiveOrgId(e.target.value)}
          className="h-8 font-medium"
        >
          <option value={ALL_ORGS}>All</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
