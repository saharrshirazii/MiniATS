import { createContext } from "react";

/** Selector value meaning "every organization" (admins only). */
export const ALL_ORGS = "all";

export type ActiveOrgContextValue = {
  /**
   * The single organization whose data the app shows and writes to.
   *   • customers: always their own organization
   *   • admins:    the organization chosen in the selector,
   *                or null when "All" is selected (see `isAll`)
   */
  activeOrgId: string | null;
  activeOrgName: string | null;
  /** Admin chose "All": pages list data from every organization. */
  isAll: boolean;
  /** True for admins — they can switch organization. */
  canSwitch: boolean;
  /** An organization id, or ALL_ORGS. */
  setActiveOrgId: (id: string) => void;
  /** True while the organization list is loading. */
  loading: boolean;
};

export const ActiveOrgContext = createContext<ActiveOrgContextValue | null>(
  null,
);
