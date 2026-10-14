import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorMessage } from "@/components/common/StatusMessages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useUpdateUser, type UserWithOrganization } from "@/hooks/useUsers";

const schema = z
  .object({
    full_name: z.string().trim().max(200, "Name is too long"),
    role: z.enum(["customer", "admin"]),
    organization_id: z.string(),
  })
  .refine((v) => v.role === "admin" || v.organization_id !== "", {
    message: "Choose the customer's organization",
    path: ["organization_id"],
  });

type Values = z.infer<typeof schema>;

type Props = {
  user: UserWithOrganization;
  /** The signed-in admin can't change their own role (no accidental lock-out). */
  isSelf: boolean;
};

const roleLabel = (role: string) => (role === "admin" ? "Admin" : "Customer");

/**
 * Two steps in one dialog:
 *   1. "edit"    – name, role, organization
 *   2. "confirm" – lists exactly what will change, before anything is saved
 */
export function EditUserDialog({ user, isSelf }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const updateUser = useUpdateUser();
  const { data: organizations = [] } = useOrganizations();

  const initial: Values = {
    full_name: user.full_name ?? "",
    role: user.role,
    organization_id: user.organization_id ?? "",
  };

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const { errors } = form.formState;
  const values = form.watch();
  const nextOrgId = values.role === "admin" ? "" : values.organization_id;

  const orgName = (id: string) =>
    id ? (organizations.find((o) => o.id === id)?.name ?? "Unknown") : "—";

  // Human-readable list of what will change, used for the confirm step.
  const changes = [
    values.full_name.trim() !== initial.full_name.trim() &&
      `Name: "${initial.full_name || "—"}" → "${values.full_name.trim() || "—"}"`,
    values.role !== initial.role && `Role: ${roleLabel(initial.role)} → ${roleLabel(values.role)}`,
    nextOrgId !== initial.organization_id &&
      `Organization: ${orgName(initial.organization_id)} → ${orgName(nextOrgId)}`,
  ].filter(Boolean) as string[];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      form.reset(initial);
      setStep("edit");
      updateUser.reset();
    }
  };

  const confirmSave = async () => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        full_name: values.full_name.trim() || null,
        role: values.role,
        organization_id: nextOrgId || null,
      });
      toast.success("User updated", {
        description: `Changes to ${user.email} were saved.`,
      });
      setOpen(false);
    } catch {
      setStep("edit"); // error is shown on the form
    }
  };

  const label = user.full_name || user.email || "user";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Edit ${label}`}>
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent>
        {step === "edit" ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
              <DialogDescription>{user.email}</DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(() => setStep("confirm"))}
              noValidate
            >
              {updateUser.error && <ErrorMessage message={updateUser.error.message} />}

              <FormField id={`edit-name-${user.id}`} label="Full name" error={errors.full_name?.message}>
                <Input id={`edit-name-${user.id}`} {...form.register("full_name")} />
              </FormField>

              <FormField
                id={`edit-role-${user.id}`}
                label="Role"
                hint={isSelf ? "You can't change your own role." : undefined}
              >
                {isSelf ? (
                  // Display only: a disabled registered field would be read as empty
                  // by react-hook-form, so the role stays in form state unchanged.
                  <NativeSelect id={`edit-role-${user.id}`} disabled value={user.role} onChange={() => {}}>
                    <option value={user.role}>{roleLabel(user.role)}</option>
                  </NativeSelect>
                ) : (
                  <NativeSelect id={`edit-role-${user.id}`} {...form.register("role")}>
                    <option value="customer">Customer – sees their organization's data</option>
                    <option value="admin">Admin – manages all organizations</option>
                  </NativeSelect>
                )}
              </FormField>

              {values.role === "customer" && (
                <FormField
                  id={`edit-org-${user.id}`}
                  label="Organization"
                  error={errors.organization_id?.message}
                >
                  <NativeSelect
                    id={`edit-org-${user.id}`}
                    aria-invalid={!!errors.organization_id}
                    {...form.register("organization_id")}
                  >
                    <option value="">Select organization…</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={changes.length === 0}>
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm changes</DialogTitle>
              <DialogDescription>
                Save these changes for <strong className="text-foreground">{user.email}</strong>?
              </DialogDescription>
            </DialogHeader>

            <ul className="list-disc space-y-1 pl-5 text-sm">
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("edit")}
                disabled={updateUser.isPending}
              >
                Back
              </Button>
              <Button type="button" onClick={confirmSave} disabled={updateUser.isPending}>
                {updateUser.isPending && <Loader2 className="animate-spin" />}
                Yes, save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
