import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { LogAction, LogEntityType } from "@/lib/activity-log";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database.types";

export const ACTIVITY_PAGE_SIZE = 25;

export type ActivityLogEntry = Tables<"activity_logs"> & {
  organizationName: string | null;
};

export type ActivityLogFilters = {
  /** One organization, or null for every organization the caller can see (admin "All"). */
  orgId: string | null;
  search: string;
  action: LogAction | "";
  entityType: LogEntityType | "";
  actorEmail: string;
  /** Inclusive local dates, "YYYY-MM-DD". */
  from: string;
  to: string;
  page: number; // 1-based
};

export const activityKeys = {
  all: ["activity"] as const,
  list: (filters: ActivityLogFilters) => ["activity", "list", filters] as const,
  actors: (orgId: string | null) =>
    ["activity", "actors", orgId ?? "all"] as const,
};

/** Start of a local day as an ISO timestamp; `addDays` moves forward (for an exclusive end). */
function startOfLocalDay(date: string, addDays = 0): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + addDays);
  return d.toISOString();
}

/** Characters that would break PostgREST's or=(…) syntax or act as wildcards. */
const unsafeSearchChars = /[,()*%\\"]/g;

/**
 * One page of the activity log, newest first. Filtering and paging run in
 * the database (the log only grows), and RLS limits customers to their
 * own organization.
 */
async function fetchActivity(f: ActivityLogFilters) {
  const fromRow = (f.page - 1) * ACTIVITY_PAGE_SIZE;

  let query = supabase
    .from("activity_logs")
    .select("*, organization:organizations(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(fromRow, fromRow + ACTIVITY_PAGE_SIZE - 1);

  if (f.orgId) query = query.eq("organization_id", f.orgId);
  if (f.action) query = query.eq("action", f.action);
  if (f.entityType) query = query.eq("entity_type", f.entityType);
  if (f.actorEmail) query = query.eq("actor_email", f.actorEmail);
  if (f.from) query = query.gte("created_at", startOfLocalDay(f.from));
  if (f.to) query = query.lt("created_at", startOfLocalDay(f.to, 1));

  const term = f.search.replace(unsafeSearchChars, " ").trim();
  if (term)
    query = query.or(
      `entity_label.ilike.*${term}*,actor_email.ilike.*${term}*`,
    );

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    entries: data.map(({ organization, ...entry }): ActivityLogEntry => ({
      ...entry,
      organizationName: organization?.name ?? null,
    })),
    total: count ?? 0,
  };
}

export function useActivityLog(filters: ActivityLogFilters, enabled = true) {
  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: () => fetchActivity(filters),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** People who appear in the visible log, for the "User" filter. */
export function useActivityActors(orgId: string | null, enabled = true) {
  return useQuery({
    queryKey: activityKeys.actors(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "activity_log_actors",
        orgId ? { p_organization_id: orgId } : {},
      );
      if (error) throw error;
      return data.map((r) => r.actor_email);
    },
    enabled,
  });
}
