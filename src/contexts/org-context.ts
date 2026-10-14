import { createContext } from "react";

export type ActiveOrgContextValue = {
  /**
   * The organization whose data the app shows and writes to.
   *   • customers: always their own organization
   *   • admins:    the organization chosen in the "Acting as" selector
   * null when there is none yet (e.g. an admin before any organization exists).
   */
  activeOrgId: string | null;
  activeOrgName: string | null;
  /** True for admins — they can switch organization. */
  canSwitch: boolean;
  setActiveOrgId: (id: string) => void;
  /** True while the organization list is loading. */
  loading: boolean;
};

export const ActiveOrgContext = createContext<ActiveOrgContextValue | null>(null);
