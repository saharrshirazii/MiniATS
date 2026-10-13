import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
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
import { useCreateOrganization } from "@/hooks/useOrganizations";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
});

type Values = z.infer<typeof schema>;

export function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const createOrganization = useCreateOrganization();

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset();
      createOrganization.reset();
    }
  };

  const onSubmit = async ({ name }: Values) => {
    try {
      await createOrganization.mutateAsync(name);
      toast.success(`Organization "${name}" created`);
      handleOpenChange(false);
    } catch {
      // Error is shown inside the dialog via createOrganization.error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>A customer company. You can add users to it afterwards.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {createOrganization.error && <ErrorMessage message={createOrganization.error.message} />}

          <FormField id="org-name" label="Name" error={form.formState.errors.name?.message}>
            <Input
              id="org-name"
              placeholder="Acme AB"
              autoFocus
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
