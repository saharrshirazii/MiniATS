import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateJob, useUpdateJob, type JobWithCounts } from "@/hooks/useJobs";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  location: z.string().trim().max(200, "Location is too long"),
  description: z.string().trim().max(10_000, "Description is too long"),
});

type Values = z.infer<typeof schema>;

type Props =
  | { mode: "create"; orgId: string | null; orgName: string | null }
  | { mode: "edit"; job: JobWithCounts };

const toInput = (v: Values) => ({
  title: v.title.trim(),
  location: v.location.trim() || null,
  description: v.description.trim() || null,
});

/**
 * Create: form → save → success toast.
 * Edit:   form → confirm step listing the changes → save → success toast.
 */
export function JobFormDialog(props: Props) {
  const isEdit = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const mutation = isEdit ? updateJob : createJob;

  const initial: Values = isEdit
    ? {
        title: props.job.title,
        location: props.job.location ?? "",
        description: props.job.description ?? "",
      }
    : { title: "", location: "", description: "" };

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const { errors } = form.formState;
  const values = form.watch();

  const changes = isEdit
    ? ([
        values.title.trim() !== initial.title && `Title: "${initial.title}" → "${values.title.trim()}"`,
        values.location.trim() !== initial.location.trim() &&
          `Location: "${initial.location || "—"}" → "${values.location.trim() || "—"}"`,
        values.description.trim() !== initial.description.trim() && "Description updated",
      ].filter(Boolean) as string[])
    : [];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      form.reset(initial);
      setStep("form");
      createJob.reset();
      updateJob.reset();
    }
  };

  const save = async (v: Values) => {
    try {
      if (isEdit) {
        await updateJob.mutateAsync({ id: props.job.id, ...toInput(v) });
        toast.success("Job updated", { description: `Changes to "${v.title.trim()}" were saved.` });
      } else {
        await createJob.mutateAsync({ orgId: props.orgId!, ...toInput(v) });
        toast.success("Job created", {
          description: `"${v.title.trim()}" was added to ${props.orgName ?? "the organization"}.`,
        });
      }
      setOpen(false);
    } catch {
      setStep("form"); // error is shown on the form
    }
  };

  const onSubmit = (v: Values) => (isEdit ? setStep("confirm") : save(v));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${props.job.title}`}>
            <Pencil />
            Edit
          </Button>
        ) : (
          <Button disabled={!props.orgId}>
            <Plus />
            New job
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit job" : "New job"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update the details candidates and your team see."
                  : `A position ${props.orgName ?? "the organization"} is recruiting for.`}
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {mutation.error && <ErrorMessage message={mutation.error.message} />}

              <FormField id="job-title" label="Title" error={errors.title?.message}>
                <Input
                  id="job-title"
                  placeholder="Frontend Developer"
                  autoFocus
                  aria-invalid={!!errors.title}
                  {...form.register("title")}
                />
              </FormField>

              <FormField id="job-location" label="Location" error={errors.location?.message}>
                <Input
                  id="job-location"
                  placeholder="Gothenburg · Hybrid"
                  {...form.register("location")}
                />
              </FormField>

              <FormField
                id="job-description"
                label="Description"
                error={errors.description?.message}
                hint="Responsibilities and requirements. Also used later for the AI CV assessment."
              >
                <Textarea
                  id="job-description"
                  rows={6}
                  className="max-h-72"
                  placeholder="What will this person do? What should they know?"
                  {...form.register("description")}
                />
              </FormField>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={(isEdit && changes.length === 0) || form.formState.isSubmitting}
                >
                  {!isEdit && createJob.isPending && <Loader2 className="animate-spin" />}
                  {isEdit ? "Save changes" : "Create job"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm changes</DialogTitle>
              <DialogDescription>Save these changes to this job?</DialogDescription>
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
                onClick={() => setStep("form")}
                disabled={updateJob.isPending}
              >
                Back
              </Button>
              <Button type="button" onClick={() => save(values)} disabled={updateJob.isPending}>
                {updateJob.isPending && <Loader2 className="animate-spin" />}
                Yes, save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
