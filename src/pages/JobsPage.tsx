import { Briefcase, Building2, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorMessage, LoadingRows } from "@/components/common/StatusMessages";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { DeleteJobDialog } from "@/components/jobs/DeleteJobDialog";
import { PurgeJobDialog, RestoreJobDialog } from "@/components/jobs/DeletedJobActions";
import { JobStatusDialog } from "@/components/jobs/JobStatusDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useJobs, type JobStatus, type JobWithCounts } from "@/hooks/useJobs";
import { workplaceLabel } from "@/lib/constants";
import {
  DELETABLE_STATUSES,
  EDITABLE_STATUSES,
  STATUS_ACTIONS,
  daysUntilPurge,
} from "@/lib/job-status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | JobStatus | "deleted";

const PAGE_SIZE = 10;

const STATUS_BADGE: Record<
  JobStatus,
  { label: string; variant: "default" | "secondary" | "outline"; className?: string }
> = {
  open: { label: "Open", variant: "default" },
  on_hold: {
    label: "On hold",
    variant: "outline",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  closed: { label: "Closed", variant: "secondary" },
  draft: { label: "Draft", variant: "outline" },
  archived: {
    label: "Archived",
    variant: "outline",
    className: "border-dashed text-muted-foreground",
  },
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On hold" },
  { value: "closed", label: "Closed" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
  // Admins only: soft-deleted jobs, restorable until they are purged.
  { value: "deleted", label: "Deleted" },
];

/** "Created by" (email + date), or "Deleted by" for soft-deleted jobs. */
function WhoAndWhen({ job }: { job: JobWithCounts }) {
  const email = job.deleted_at ? job.deleted_by_email : job.created_by_email;
  return (
    <>
      <p className="truncate" title={email ?? undefined}>
        {email ?? <span className="text-muted-foreground">—</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatDate(job.deleted_at ?? job.created_at)}
      </p>
    </>
  );
}

export function JobsPage() {
  const { activeOrgId, activeOrgName, isAll, canSwitch, loading: orgLoading } = useActiveOrg();
  const { data: jobs, isPending, error } = useJobs({ orgId: activeOrgId, all: isAll });
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Search title, location and (with "All") organization name — case-insensitive. Jobs per organization are few,
  // so filtering in the browser is fine; move to the database if that changes.
  const term = search.trim().toLowerCase();
  const matching =
    jobs?.filter(
      (j) =>
        !term ||
        j.title.toLowerCase().includes(term) ||
        (j.location ?? "").toLowerCase().includes(term) ||
        (isAll && (j.organizationName ?? "").toLowerCase().includes(term)),
    ) ?? [];

  // Soft-deleted jobs only reach admins (RLS) and only appear in the Deleted tab.
  const active = matching.filter((j) => !j.deleted_at);
  const deleted = matching.filter((j) => j.deleted_at);
  const countOf = (status: JobStatus) => active.filter((j) => j.status === status).length;
  const counts: Record<Filter, number> = {
    // "All" leaves out archived jobs; they have their own tab.
    all: active.length - countOf("archived"),
    open: countOf("open"),
    on_hold: countOf("on_hold"),
    closed: countOf("closed"),
    draft: countOf("draft"),
    archived: countOf("archived"),
    deleted: deleted.length,
  };
  const filters = FILTERS.filter((f) => f.value !== "deleted" || canSwitch);
  const filterLabel =
    filter === "all" ? "" : `${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} `;
  const showingDeleted = filter === "deleted";
  const filtered =
    filter === "deleted"
      ? deleted
      : active.filter((j) => (filter === "all" ? j.status !== "archived" : j.status === filter));

  // Clamp in case the list shrank (search, filter, organization switch, close).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleJobs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const header = (
    <PageHeader
      title="Jobs"
      description={
        isAll
          ? "Positions all organizations are recruiting for."
          : activeOrgName
            ? `Positions ${activeOrgName} is recruiting for.`
            : "Positions you are recruiting for."
      }
      actions={<JobFormDialog mode="create" />}
    />
  );

  // Admin without any organization yet.
  if (!orgLoading && !activeOrgId && !isAll) {
    return (
      <>
        {header}
        <EmptyState
          icon={Building2}
          title="No organization selected"
          description={
            canSwitch
              ? "Create an organization first, then manage its jobs here."
              : "Your account is not linked to an organization."
          }
          action={
            canSwitch && (
              <Button asChild variant="outline">
                <Link to="/admin/organizations">Go to organizations</Link>
              </Button>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      {header}

      {(isPending || orgLoading) && <LoadingRows />}
      {error && <ErrorMessage message={`Could not load jobs: ${error.message}`} />}

      {jobs && jobs.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Post the first position you are recruiting for."
        />
      )}

      {jobs && jobs.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Filter jobs by status" className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => {
                    setFilter(f.value);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    filter === f.value
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  {f.label}{" "}
                  <span className="ml-1 text-xs text-muted-foreground">{counts[f.value]}</span>
                </button>
              ))}
            </div>

            <div className={cn("relative w-full", isAll ? "sm:w-96" : "sm:w-72")}>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search jobs"
                placeholder={
                  isAll
                    ? "Search by title, location or organization"
                    : "Search by title or location"
                }
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {term ? `No ${filterLabel}jobs match "${search.trim()}".` : `No ${filterLabel}jobs.`}
            </p>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table className={cn("table-fixed", isAll ? "min-w-[1060px]" : "min-w-[940px]")}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={cn("pl-4", isAll ? "w-[19%]" : "w-[25%]")}>
                        Title
                      </TableHead>
                      {isAll && <TableHead className="w-[11%]">Organization</TableHead>}
                      <TableHead className="w-[8%]">Status</TableHead>
                      <TableHead className={isAll ? "w-[8%]" : "w-[9%]"}>Candidates</TableHead>
                      <TableHead className={isAll ? "w-[17%]" : "w-[20%]"}>
                        {showingDeleted ? "Deleted by" : "Created by"}
                      </TableHead>
                      <TableHead className={cn("pr-4 text-right", isAll ? "w-[37%]" : "w-[38%]")}>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="pl-4">
                          <p className="truncate font-medium" title={job.title}>
                            {job.title}
                          </p>
                          {(job.location || job.workplace_type) && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              {[job.location, workplaceLabel(job.workplace_type)]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </TableCell>
                        {isAll && (
                          <TableCell className="truncate" title={job.organizationName ?? undefined}>
                            {job.organizationName}
                          </TableCell>
                        )}
                        <TableCell>
                          {job.deleted_at ? (
                            <>
                              <Badge variant="destructive">Deleted</Badge>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {daysUntilPurge(job.deleted_at)} days left
                              </p>
                            </>
                          ) : (
                            <Badge
                              variant={STATUS_BADGE[job.status].variant}
                              className={STATUS_BADGE[job.status].className}
                            >
                              {STATUS_BADGE[job.status].label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{job.candidateCount}</TableCell>
                        <TableCell>
                          <WhoAndWhen job={job} />
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex justify-end gap-1">
                            {job.deleted_at ? (
                              <>
                                <RestoreJobDialog job={job} />
                                <PurgeJobDialog job={job} />
                              </>
                            ) : (
                              <>
                                {EDITABLE_STATUSES.includes(job.status) && (
                                  <JobFormDialog mode="edit" job={job} />
                                )}
                                {STATUS_ACTIONS[job.status].map((action) => (
                                  <JobStatusDialog key={action} job={job} action={action} />
                                ))}
                                {DELETABLE_STATUSES.includes(job.status) && (
                                  <DeleteJobDialog job={job} />
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={filtered.length}
                onPageChange={setPage}
                itemLabel="jobs"
              />
            </>
          )}
        </>
      )}
    </>
  );
}
