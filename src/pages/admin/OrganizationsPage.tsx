import { Building2 } from "lucide-react";

import { CreateOrganizationDialog } from "@/components/admin/CreateOrganizationDialog";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="pr-4">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="pl-4 font-medium">{org.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{org.userCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{org.jobCount}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    {formatDate(org.created_at)}
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
