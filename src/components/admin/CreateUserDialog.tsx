import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, RefreshCw } from "lucide-react";
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
import { PasswordInput } from "@/components/ui/password-input";
import { generatePassword } from "@/lib/format";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useCreateUser } from "@/hooks/useUsers";

// Mirrors the validation in supabase/functions/create-user, so most errors
// are caught before the request is sent.
const schema = z
  .object({
    full_name: z.string().trim().max(200),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(72, "At most 72 characters"),
    role: z.enum(["customer", "admin"]),
    organization_id: z.string(),
  })
  .refine((v) => v.role === "admin" || v.organization_id !== "", {
    message: "Choose the customer's organization",
    path: ["organization_id"],
  });

type Values = z.infer<typeof schema>;

const defaultValues: Values = {
  full_name: "",
  email: "",
  password: "",
  role: "customer",
  organization_id: "",
};

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const createUser = useCreateUser();
  const { data: organizations = [] } = useOrganizations();

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  const { errors, isSubmitting } = form.formState;
  const role = form.watch("role");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset(defaultValues);
      createUser.reset();
    }
  };

  const onSubmit = async (values: Values) => {
    try {
      await createUser.mutateAsync({
        email: values.email,
        password: values.password,
        role: values.role,
        organization_id: values.role === "customer" ? values.organization_id : null,
        full_name: values.full_name || null,
      });
      toast.success(`Account created for ${values.email}`, {
        description: "Share the password with them securely.",
      });
      handleOpenChange(false);
    } catch {
      // Error is shown inside the dialog via createUser.error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            Create an account. The user can sign in right away with this password.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          autoComplete="off"
        >
          {createUser.error && <ErrorMessage message={createUser.error.message} />}

          <FormField id="user-role" label="Role">
            <NativeSelect id="user-role" {...form.register("role")}>
              <option value="customer">Customer – sees their organization's data</option>
              <option value="admin">Admin – manages all organizations</option>
            </NativeSelect>
          </FormField>

          {role === "customer" && (
            <FormField
              id="user-org"
              label="Organization"
              error={errors.organization_id?.message}
              hint={organizations.length === 0 ? "Create an organization first." : undefined}
            >
              <NativeSelect
                id="user-org"
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

          <FormField id="user-name" label="Full name" error={errors.full_name?.message}>
            <Input
              id="user-name"
              placeholder="Anna Andersson"
              autoComplete="off"
              {...form.register("full_name")}
            />
          </FormField>

          <FormField id="user-email" label="Email" error={errors.email?.message}>
            <Input
              id="user-email"
              type="email"
              placeholder="anna@acme.se"
              // "off" keeps Chrome from offering to autofill the signed-in
              // admin's own saved login into this (unrelated) new-account
              // email field.
              autoComplete="off"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
          </FormField>

          <FormField
            id="user-password"
            label="Temporary password"
            error={errors.password?.message}
            hint="At least 8 characters."
          >
            <div className="flex gap-2">
              <PasswordInput
                id="user-password"
                // "new-password" tells the browser this sets a brand-new
                // password rather than entering an existing login — unlike
                // "off", browsers generally respect this and won't offer to
                // autofill the admin's own saved credentials here.
                autoComplete="new-password"
                spellCheck={false}
                className="font-mono"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  form.setValue("password", generatePassword(), { shouldValidate: true })
                }
              >
                <RefreshCw />
                Generate
              </Button>
            </div>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
