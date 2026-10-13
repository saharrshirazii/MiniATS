import { UserCog } from "lucide-react";

import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { EmptyState, ErrorMessage, LoadingRows } from "@/components/common/StatusMessages";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import { formatDate } from "@/lib/format";

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isPending, error } = useUsers();

  return (
    <>
      <PageHeader
        title="Users"
        description="Create admin and customer accounts."
        actions={<CreateUserDialog />}
      />

      {isPending && <LoadingRows />}
      {error && <ErrorMessage message={`Could not load users: ${error.message}`} />}

      {users?.length === 0 && (
        <EmptyState icon={UserCog} title="No users yet" description="Create the first account." />
      )}

      {users && users.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="pr-4">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="pl-4 font-medium">
                    {user.full_name || <span className="text-muted-foreground">—</span>}
                    {user.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "Admin" : "Customer"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.organization?.name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    {formatDate(user.created_at)}
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
