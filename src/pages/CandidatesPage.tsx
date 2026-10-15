import { Building2, ExternalLink, Mail, Phone, Users, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { CandidateDetailSheet } from "@/components/candidates/CandidateDetailSheet";
import { CandidateFormDialog } from "@/components/candidates/CandidateFormDialog";
import { CvLink } from "@/components/candidates/CvLink";
import { DeleteCandidateDialog } from "@/components/candidates/DeleteCandidateDialog";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorMessage, LoadingRows } from "@/components/common/StatusMessages";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useCandidates, type CandidateWithApplications } from "@/hooks/useCandidates";
import { useJobs } from "@/hooks/useJobs";
import { STAGES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const PAGE_SIZE = 10;
const TALENT_POOL = "talent-pool";
const stageLabel = (stage: string) => STAGES.find((s) => s.value === stage)?.label ?? stage;
const isTalentPool = (c: CandidateWithApplications) => !c.applications.some((a) => a.job);

/** Contact column: email and phone, each with an icon; a dash when neither is set. */
function Contact({ candidate }: { candidate: CandidateWithApplications }) {
  if (!candidate.email && !candidate.phone) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-0.5 text-sm">
      {candidate.email && (
        <a
          href={`mailto:${candidate.email}`}
          className="flex items-center gap-1.5 truncate hover:underline"
          title={candidate.email}
        >
          <Mail className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{candidate.email}</span>
        </a>
      )}
      {candidate.phone && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="size-3 shrink-0" />
          {candidate.phone}
        </p>
      )}
    </div>
  );
}

/** The jobs a candidate is in the pipeline for, with their stage — or "Talent pool". */
function Jobs({ candidate }: { candidate: CandidateWithApplications }) {
  const linked = candidate.applications.filter((a) => a.job);
  if (isTalentPool(candidate)) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Talent pool
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {linked.map((a) => (
        <Badge key={a.job!.id} variant="secondary" className="max-w-[12rem]">
          <span className="truncate">{a.job!.title}</span>
          <span className="ml-1 text-muted-foreground">· {stageLabel(a.stage)}</span>
        </Badge>
      ))}
    </div>
  );
}

export function CandidatesPage() {
  const { activeOrgId, activeOrgName, isAll, canSwitch, loading: orgLoading } = useActiveOrg();
  const { data: candidates, isPending, error } = useCandidates({ orgId: activeOrgId, all: isAll });
  const { data: jobs } = useJobs({ orgId: activeOrgId, all: isAll });
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Look the selected candidate up fresh each render, so an edit (or any
  // refetch) is reflected in the open sheet instead of a stale snapshot.
  const selectedCandidate = candidates?.find((c) => c.id === selectedId) ?? null;

  const term = search.trim().toLowerCase();
  const hasFilters = term !== "" || jobFilter !== "";
  const filtered =
    candidates?.filter(
      (c) =>
        (!term ||
          c.full_name.toLowerCase().includes(term) ||
          (c.email ?? "").toLowerCase().includes(term) ||
          (isAll && (c.organizationName ?? "").toLowerCase().includes(term))) &&
        (!jobFilter ||
          (jobFilter === TALENT_POOL
            ? isTalentPool(c)
            : c.applications.some((a) => a.job?.id === jobFilter))),
    ) ?? [];

  const setFilter = (next: { search?: string; jobFilter?: string }) => {
    if (next.search !== undefined) setSearch(next.search);
    if (next.jobFilter !== undefined) setJobFilter(next.jobFilter);
    setPage(1);
  };
  const clearFilters = () => setFilter({ search: "", jobFilter: "" });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const header = (
    <PageHeader
      title="Candidates"
      description={
        isAll
          ? "Everyone in every organization's talent pool."
          : activeOrgName
            ? `Everyone in ${activeOrgName}'s talent pool.`
            : "Everyone in your talent pool."
      }
      actions={<CandidateFormDialog />}
    />
  );

  if (!orgLoading && !activeOrgId && !isAll) {
    return (
      <>
        {header}
        <EmptyState
          icon={Building2}
          title="No organization selected"
          description={
            canSwitch
              ? "Create an organization first, then manage its candidates here."
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
      {error && <ErrorMessage message={`Could not load candidates: ${error.message}`} />}

      {candidates && candidates.length === 0 && (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Add the first candidate to your talent pool."
        />
      )}

      {candidates && candidates.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <div className="w-full sm:w-56">
              <NativeSelect
                aria-label="Filter by job"
                value={jobFilter}
                onChange={(e) => setFilter({ jobFilter: e.target.value })}
              >
                <option value="">All jobs</option>
                <option value={TALENT_POOL}>Talent pool</option>
                {jobs
                  ?.filter((j) => !j.deleted_at)
                  .map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
              </NativeSelect>
            </div>
            <div className={cn("relative w-full", isAll ? "sm:w-96" : "sm:w-72")}>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search candidates"
                placeholder={
                  isAll ? "Search by name, email or organization" : "Search by name or email"
                }
                className="pl-9"
                value={search}
                onChange={(e) => setFilter({ search: e.target.value })}
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X />
                Clear filters
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No candidates match these filters.
            </p>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table className={cn("table-fixed", isAll ? "min-w-[1040px]" : "min-w-[920px]")}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={cn("pl-4", isAll ? "w-[16%]" : "w-[20%]")}>
                        Name
                      </TableHead>
                      {isAll && <TableHead className="w-[12%]">Organization</TableHead>}
                      <TableHead className="w-[20%]">Contact</TableHead>
                      <TableHead className="w-[8%]">Links</TableHead>
                      <TableHead className={isAll ? "w-[22%]" : "w-[28%]"}>Jobs</TableHead>
                      <TableHead className="w-[10%]">Added</TableHead>
                      <TableHead className="w-[12%] pr-4 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((candidate) => (
                      <TableRow
                        key={candidate.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(candidate.id)}
                      >
                        <TableCell className="pl-4">
                          <p className="truncate font-medium" title={candidate.full_name}>
                            {candidate.full_name}
                          </p>
                        </TableCell>
                        {isAll && (
                          <TableCell
                            className="truncate"
                            title={candidate.organizationName ?? undefined}
                          >
                            {candidate.organizationName}
                          </TableCell>
                        )}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Contact candidate={candidate} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {candidate.linkedin_url || candidate.cv_path ? (
                            <div className="flex flex-col gap-0.5">
                              {candidate.linkedin_url && (
                                <a
                                  href={candidate.linkedin_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                  LinkedIn <ExternalLink className="size-3" />
                                </a>
                              )}
                              {candidate.cv_path && <CvLink path={candidate.cv_path} />}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Jobs candidate={candidate} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(candidate.created_at)}
                        </TableCell>
                        <TableCell
                          className="pr-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DeleteCandidateDialog candidate={candidate} />
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
                itemLabel="candidates"
              />
            </>
          )}
        </>
      )}

      <CandidateDetailSheet
        candidate={selectedCandidate}
        showOrganization={isAll}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
