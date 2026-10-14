import { Building2 } from "lucide-react";

import { CreateOrganizationDialog } from "@/components/admin/CreateOrganizationDialog";
import { DeleteOrganizationDialog } from "@/components/admin/DeleteOrganizationDialog";
import { EditOrganizationDialog } from "@/components/admin/EditOrganizationDialog";
import { EmptyState, ErrorMessage, LoadingRows } from "@/components/common/StatusMessages";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizations } from "@/hooks/useOrganizations";
import { formatDate } from "@/lib/format";

export function OrganizationsPage() {
  const { data: organizations, isPending, error } = useOrganizations();

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Customer companies using MiniATS."
        actions={<CreateOrganizationDialog />}
      />

      {isPending && <LoadingRows />}
      {error && <ErrorMessage message={`Could not load organizations: ${error.message}`} />}

      {organizations?.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No organizations yet"
          description="Create your first customer to get started."
        />
      )}

      {organizations && organizations.length > 0 && (
        <div className="rounded-lg border">
          <Table className="min-w-[640px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32%] pl-4">Name</TableHead>
                <TableHead className="w-[12%]">Users</TableHead>
                <TableHead className="w-[12%]">Jobs</TableHead>
                <TableHead className="w-[18%]">Created</TableHead>
                <TableHead className="w-[26%] pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="truncate pl-4 font-medium" title={org.name}>
                    {org.name}
                  </TableCell>
                  <TableCell className="tabular-nums">{org.userCount}</TableCell>
                  <TableCell className="tabular-nums">{org.jobCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(org.created_at)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      <EditOrganizationDialog organization={org} />
                      <DeleteOrganizationDialog organization={org} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
