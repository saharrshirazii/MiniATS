import { Building2, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { EmptyState, ErrorMessage, LoadingRows } from "@/components/common/StatusMessages";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useApplications } from "@/hooks/useApplications";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useJobs } from "@/hooks/useJobs";

/** Pipeline across every job, filterable by job and candidate name (kept in the URL, shareable). */
export function KanbanPage() {
  const { activeOrgId, activeOrgName, isAll, canSwitch, loading: orgLoading } = useActiveOrg();
  const [params, setParams] = useSearchParams();

  const jobFilter = params.get("job") ?? "";
  const search = params.get("q") ?? "";
  const debouncedSearch = useDebouncedValue(search);

  const { data: jobs } = useJobs({ orgId: activeOrgId, all: false });
  const { data: applications, isPending, error } = useApplications(activeOrgId);

  const setFilter = (key: "job" | "q", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const term = debouncedSearch.trim().toLowerCase();
  const filtered =
    applications?.filter(
      (a) =>
        (!jobFilter || a.job.id === jobFilter) &&
        (!term || a.candidate.full_name.toLowerCase().includes(term)),
    ) ?? [];

  const hasFilters = jobFilter !== "" || search !== "";
  const header = <PageHeader title="Pipeline" description="All candidates across your jobs." />;

  if (!orgLoading && !activeOrgId && !isAll) {
    return (
      <>
        {header}
        <EmptyState
          icon={Building2}
          title="No organization selected"
          description={
            canSwitch
              ? "Create an organization first, then view its pipeline here."
              : "Your account is not linked to an organization."
          }
        />
      </>
    );
  }

  // The board shows one organization's pipeline at a time (drag and drop within a
  // mixed-organization board would be confusing); admins pick one to view it.
  if (isAll) {
    return (
      <>
        {header}
        <EmptyState
          icon={Building2}
          title="Choose an organization"
          description="Select an organization in the header to see its pipeline."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          activeOrgName
            ? `All candidates across ${activeOrgName}'s jobs.`
            : "All candidates across your jobs."
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-56">
          <NativeSelect
            aria-label="Filter by job"
            value={jobFilter}
            onChange={(e) => setFilter("job", e.target.value)}
          >
            <option value="">All jobs</option>
            {/* While jobs are still loading, a job chosen via the URL (a shared link) has
                no matching <option> yet — without this, the browser silently falls back
                to "All jobs" until the real option appears a moment later. */}
            {jobFilter && !jobs?.some((j) => j.id === jobFilter) && (
              <option value={jobFilter}>Loading…</option>
            )}
            {jobs
              ?.filter((j) => !j.deleted_at)
              .map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
          </NativeSelect>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search candidates by name"
            placeholder="Search by candidate name"
            className="pl-9"
            value={search}
            onChange={(e) => setFilter("q", e.target.value)}
          />
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            <X />
            Clear filters
          </Button>
        )}
      </div>

      {(isPending || orgLoading) && <LoadingRows />}
      {error && <ErrorMessage message={`Could not load the pipeline: ${error.message}`} />}

      {applications && applications.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No candidates in the pipeline yet"
          description="Add a candidate to a job to see them here."
        />
      )}

      {applications && applications.length > 0 && (
        <>
          {hasFilters && filtered.length === 0 && (
            <p className="mb-3 text-sm text-muted-foreground">No candidates match these filters.</p>
          )}
          <KanbanBoard orgId={activeOrgId!} applications={filtered} />
        </>
      )}
    </>
  );
}
