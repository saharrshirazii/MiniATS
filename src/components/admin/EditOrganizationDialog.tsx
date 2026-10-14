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
import { useUpdateOrganization } from "@/hooks/useOrganizations";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name is too long"),
});

type Values = z.infer<typeof schema>;

type Props = {
  organization: { id: string; name: string };
};

/**
 * Two steps in one dialog:
 *   1. "edit"    – change the name
 *   2. "confirm" – "Rename X to Y?" before anything is saved
 */
export function EditOrganizationDialog({ organization }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const updateOrganization = useUpdateOrganization();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: organization.name },
  });

  const newName = form.watch("name").trim();
  const unchanged = newName === organization.name;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      form.reset({ name: organization.name });
      setStep("edit");
      updateOrganization.reset();
    }
  };

  const confirmRename = async () => {
    try {
      const updated = await updateOrganization.mutateAsync({
        id: organization.id,
        name: newName,
      });
      toast.success("Organization updated", {
        description: `"${organization.name}" was renamed to "${updated.name}".`,
      });
      setOpen(false);
    } catch {
      // Error is shown in the dialog; go back so the user can try again.
      setStep("edit");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Edit ${organization.name}`}
        >
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent>
        {step === "edit" ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit organization</DialogTitle>
              <DialogDescription>
                Change the name shown to admins and users.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(() => setStep("confirm"))}
              noValidate
            >
              {updateOrganization.error && (
                <ErrorMessage
                  message={`Could not save: ${updateOrganization.error.message}`}
                />
              )}

              <FormField
                id={`org-name-${organization.id}`}
                label="Name"
                error={form.formState.errors.name?.message}
              >
                <Input
                  id={`org-name-${organization.id}`}
                  autoFocus
                  aria-invalid={!!form.formState.errors.name}
                  {...form.register("name")}
                />
              </FormField>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={unchanged}>
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
                Rename{" "}
                <strong className="text-foreground">{organization.name}</strong>{" "}
                to <strong className="text-foreground">{newName}</strong>? All
                users of this organization will see the new name.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("edit")}
                disabled={updateOrganization.isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={confirmRename}
                disabled={updateOrganization.isPending}
              >
                {updateOrganization.isPending && (
                  <Loader2 className="animate-spin" />
                )}
                Yes, rename
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
