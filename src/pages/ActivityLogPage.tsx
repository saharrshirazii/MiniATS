import { Building2, History, RefreshCw, Search, X } from "lucide-react";
import { useState } from "react";

import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorMessage, LoadingRows } from "@/components/common/StatusMessages";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  ACTIVITY_PAGE_SIZE,
  useActivityActors,
  useActivityLog,
  useRefreshActivity,
  type ActivityLogEntry,
  type ActivityLogFilters,
} from "@/hooks/useActivityLog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  LOG_ENTITY_TYPES,
  actionsForEntity,
  describeDetails,
  logActionLabel,
  logEntityLabel,
  type LogAction,
  type LogEntityType,
} from "@/lib/activity-log";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTION_BADGE: Record<LogAction, string> = {
  created: "border-emerald-200 bg-emerald-50 text-emerald-800",
  updated: "border-slate-200 bg-slate-50 text-slate-700",
  status_changed: "border-sky-200 bg-sky-50 text-sky-800",
  deleted: "border-amber-200 bg-amber-50 text-amber-800",
  restored: "border-emerald-200 bg-emerald-50 text-emerald-800",
  deleted_permanently: "border-red-200 bg-red-50 text-red-800",
};

type FilterState = Omit<ActivityLogFilters, "orgId" | "page" | "search">;

const NO_FILTERS: FilterState = {
  action: "",
  entityType: "",
  actorEmail: "",
  from: "",
  to: "",
};

function Actor({ entry }: { entry: ActivityLogEntry }) {
  if (!entry.actor_email) {
    return <span className="text-muted-foreground">System</span>;
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate" title={entry.actor_email}>
        {entry.actor_email}
      </span>
      {entry.actor_role === "admin" && (
        <Badge variant="secondary" className="shrink-0">
          Admin
        </Badge>
      )}
    </div>
  );
}

/** Activity log of the active organization (customers: always their own), or of all (admin "All"). */
export function ActivityLogPage() {
  const { activeOrgId, activeOrgName, isAll, canSwitch, loading } = useActiveOrg();

  const header = (
    <PageHeader
      title="Activity log"
      description={
        isAll
          ? "Every change in every organization, newest first."
          : activeOrgName
            ? `Every change in ${activeOrgName}, newest first, including changes made by admins.`
            : "Every change in your organization, newest first."
      }
    />
  );

  if (!loading && !activeOrgId && !isAll) {
    return (
      <>
        {header}
        <EmptyState
          icon={Building2}
          title="No organization selected"
          description={
            canSwitch
              ? "Choose an organization (or All) in the header."
              : "Your account is not linked to an organization."
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      {/* Remount on organization switch so filters (e.g. the selected user) start fresh. */}
      <ActivityLogView key={activeOrgId ?? "all"} orgId={activeOrgId} showOrganization={isAll} />
    </>
  );
}

function ActivityLogView({
  orgId,
  showOrganization,
}: {
  orgId: string | null;
  showOrganization: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const { data, isPending, isFetching, error } = useActivityLog({
    orgId,
    search: debouncedSearch,
    page,
    ...filters,
  });
  const { data: actors } = useActivityActors(orgId);
  const refreshActivity = useRefreshActivity();

  // The newest entries are on page 1, so a refresh goes there (filters are kept).
  const refresh = () => {
    setPage(1);
    void refreshActivity();
  };

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  // Changing the item type can make the current Action filter meaningless
  // (e.g. "Status changed" only happens for jobs) — drop it when so.
  const setEntityType = (value: LogEntityType | "") => {
    setFilters((f) => {
      const allowed = actionsForEntity(value);
      const action = f.action && !allowed.includes(f.action) ? "" : f.action;
      return { ...f, entityType: value, action };
    });
    setPage(1);
  };
  const hasFilters = search !== "" || Object.values(filters).some((v) => v !== "");
  const clearFilters = () => {
    setSearch("");
    setFilters(NO_FILTERS);
    setPage(1);
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Button
          variant="outline"
          onClick={refresh}
          disabled={isFetching}
          aria-label="Refresh activity log"
          title="Load the latest activity"
        >
          <RefreshCw className={cn(isFetching && "animate-spin")} />
          Refresh
        </Button>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search activity"
            placeholder="Search item or email"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="w-32 space-y-1">
          <Label htmlFor="log-entity" className="text-xs text-muted-foreground">
            Item type
          </Label>
          <NativeSelect
            id="log-entity"
            value={filters.entityType}
            onChange={(e) => setEntityType(e.target.value as LogEntityType | "")}
          >
            <option value="">All items</option>
            {LOG_ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="w-36 space-y-1">
          <Label htmlFor="log-action" className="text-xs text-muted-foreground">
            Action
          </Label>
          <NativeSelect
            id="log-action"
            value={filters.action}
            onChange={(e) => setFilter("action", e.target.value as LogAction | "")}
          >
            <option value="">All actions</option>
            {actionsForEntity(filters.entityType).map((value) => (
              <option key={value} value={value}>
                {logActionLabel(value)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="w-48 space-y-1">
          <Label htmlFor="log-user" className="text-xs text-muted-foreground">
            User
          </Label>
          <NativeSelect
            id="log-user"
            value={filters.actorEmail}
            onChange={(e) => setFilter("actorEmail", e.target.value)}
          >
            <option value="">All users</option>
            {actors?.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="w-36 space-y-1">
          <Label htmlFor="log-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="log-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </div>

        <div className="w-36 space-y-1">
          <Label htmlFor="log-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="log-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilter("to", e.target.value)}
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="mb-0.5" onClick={clearFilters}>
            <X />
            Clear filters
          </Button>
        )}
      </div>

      {isPending && <LoadingRows />}
      {error && <ErrorMessage message={`Could not load the activity log: ${error.message}`} />}

      {data && data.total === 0 && !hasFilters && (
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Changes to jobs appear here as soon as they happen."
        />
      )}

      {data && data.total === 0 && hasFilters && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No activity matches these filters.
        </p>
      )}

      {data && data.total > 0 && (
        <>
          <div
            className={cn("rounded-lg border transition-opacity", isFetching && "opacity-60")}
            aria-busy={isFetching}
          >
            <Table
              className={cn("table-fixed", showOrganization ? "min-w-[1060px]" : "min-w-[920px]")}
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%] pl-4">When</TableHead>
                  {showOrganization && <TableHead className="w-[12%]">Organization</TableHead>}
                  <TableHead className={showOrganization ? "w-[20%]" : "w-[23%]"}>User</TableHead>
                  <TableHead className="w-[14%]">Action</TableHead>
                  <TableHead className={showOrganization ? "w-[17%]" : "w-[20%]"}>Item</TableHead>
                  <TableHead className={cn("pr-4", showOrganization ? "w-[22%]" : "w-[28%]")}>
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => {
                  const details = describeDetails(entry.details);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4 text-sm whitespace-nowrap tabular-nums">
                        {formatDateTime(entry.created_at)}
                      </TableCell>
                      {showOrganization && (
                        <TableCell className="truncate" title={entry.organizationName ?? undefined}>
                          {entry.organizationName ?? (
                            <span className="text-muted-foreground">Deleted</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <Actor entry={entry} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ACTION_BADGE[entry.action]}>
                          {logActionLabel(entry.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="truncate font-medium" title={entry.entity_label}>
                          {entry.entity_label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {logEntityLabel(entry.entity_type)}
                        </p>
                      </TableCell>
                      <TableCell className="pr-4 text-sm text-muted-foreground">
                        {details.length === 0
                          ? "—"
                          : details.map((line) => (
                              <p key={line} className="truncate" title={line}>
                                {line}
                              </p>
                            ))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={currentPage}
            pageSize={ACTIVITY_PAGE_SIZE}
            totalItems={total}
            onPageChange={setPage}
            itemLabel="entries"
          />
        </>
      )}
    </>
  );
}
