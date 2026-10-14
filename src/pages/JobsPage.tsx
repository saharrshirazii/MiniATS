import { Briefcase, Building2, MapPin } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorMessage, LoadingRows } from "@/components/common/StatusMessages";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { JobStatusDialog } from "@/components/jobs/JobStatusDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useJobs, type JobStatus } from "@/hooks/useJobs";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | JobStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

export function JobsPage() {
  const { activeOrgId, activeOrgName, canSwitch, loading: orgLoading } = useActiveOrg();
  const { data: jobs, isPending, error } = useJobs(activeOrgId);
  const [filter, setFilter] = useState<Filter>("open");

  const counts = {
    all: jobs?.length ?? 0,
    open: jobs?.filter((j) => j.status === "open").length ?? 0,
    closed: jobs?.filter((j) => j.status === "closed").length ?? 0,
  };
  const visibleJobs = jobs?.filter((j) => filter === "all" || j.status === filter) ?? [];

  const header = (
    <PageHeader
      title="Jobs"
      description={
        activeOrgName ? `Positions ${activeOrgName} is recruiting for.` : "Positions you are recruiting for."
      }
      actions={<JobFormDialog mode="create" orgId={activeOrgId} orgName={activeOrgName} />}
    />
  );

  // Admin without any organization yet.
  if (!orgLoading && !activeOrgId) {
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
          <div role="tablist" aria-label="Filter jobs by status" className="mb-4 flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {f.label} <span className="ml-1 text-xs text-muted-foreground">{counts[f.value]}</span>
              </button>
            ))}
          </div>

          {visibleJobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No {filter === "all" ? "" : filter} jobs.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table className="min-w-[760px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%] pl-4">Title</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="w-[12%]">Candidates</TableHead>
                    <TableHead className="w-[14%]">Created</TableHead>
                    <TableHead className="w-[24%] pr-4 text-right">
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
                        {job.location && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            {job.location}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.status === "open" ? "default" : "secondary"}>
                          {job.status === "open" ? "Open" : "Closed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{job.candidateCount}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(job.created_at)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          <JobFormDialog mode="edit" job={job} />
                          <JobStatusDialog job={job} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </>
  );
}
