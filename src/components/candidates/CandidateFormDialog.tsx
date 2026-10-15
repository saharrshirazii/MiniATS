import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Heart, Loader2, Plus, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useCreateCandidate, useParseCv } from "@/hooks/useCandidates";
import { useJobs } from "@/hooks/useJobs";
import { useOrganizations } from "@/hooks/useOrganizations";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(100, "Too long"),
    last_name: z.string().trim().min(1, "Last name is required").max(100, "Too long"),
    email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
    phone: z.string().trim().max(40, "Too long"),
    linkedin_url: z.union([
      z
        .string()
        .trim()
        .regex(/^https?:\/\//i, "Enter a full URL (https://…)"),
      z.literal(""),
    ]),
    mode: z.enum(["job", "general"]),
    job_id: z.string(),
    organization_id: z.string(),
    notes: z.string().trim().max(10_000, "Too long"),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone && !v.linkedin_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Provide at least one contact: email, phone or LinkedIn.",
      });
    }
    if (v.mode === "job" && !v.job_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["job_id"], message: "Choose a job." });
    }
    if (!v.organization_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organization_id"],
        message: "Choose an organization.",
      });
    }
  });

type FormState = z.input<typeof schema>;
type ValidCandidate = z.output<typeof schema>;

export function CandidateFormDialog() {
  const { activeOrgId, isAll } = useActiveOrg();
  const [open, setOpen] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const createCandidate = useCreateCandidate();
  const parseCv = useParseCv();
  const { data: organizations } = useOrganizations();

  const form = useForm<FormState, unknown, ValidCandidate>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      linkedin_url: "",
      mode: "job",
      job_id: "",
      organization_id: isAll ? "" : (activeOrgId ?? ""),
      notes: "",
    },
  });
  const { register, handleSubmit, watch, setValue, reset, formState } = form;
  const { errors } = formState;

  const mode = watch("mode");
  // Jobs come from the chosen organization (admins) or the active one (customers).
  const jobOrgId = isAll ? watch("organization_id") : activeOrgId;
  const { data: jobs, isPending: jobsLoading } = useJobs({ orgId: jobOrgId || null, all: false });
  const openJobs = jobs?.filter((j) => j.status === "open" && !j.deleted_at) ?? [];

  const clearCv = () => {
    setCvFileName(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const resetAll = (next: boolean) => {
    setOpen(next);
    if (next) {
      createCandidate.reset();
      clearCv();
      reset({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        linkedin_url: "",
        mode: "job",
        job_id: "",
        organization_id: isAll ? "" : (activeOrgId ?? ""),
        notes: "",
      });
    }
  };

  // Fill empty fields from a CV, so a user's own typing is never overwritten.
  const fillFromCv = async (file: File) => {
    try {
      const parsed = await parseCv.mutateAsync(file);
      const current = form.getValues();
      let filled = 0;
      const setIfEmpty = (name: keyof FormState, value: string | null) => {
        if (value && !current[name]) {
          setValue(name, value, { shouldValidate: true });
          filled++;
        }
      };
      if (parsed.full_name) {
        const [first, ...rest] = parsed.full_name.split(/\s+/);
        setIfEmpty("first_name", first);
        setIfEmpty("last_name", rest.join(" ") || null);
      }
      setIfEmpty("email", parsed.email);
      setIfEmpty("phone", parsed.phone);
      setIfEmpty("linkedin_url", parsed.linkedin_url);

      if (filled > 0) {
        toast.success("Filled from the CV", {
          description: "Please check the details before saving.",
        });
      } else {
        toast.info("No new details found in the CV", {
          description: "Please fill the form in manually.",
        });
      }
    } catch (error) {
      toast.error("Could not read the CV", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const onSubmit = async (values: ValidCandidate) => {
    try {
      const candidate = await createCandidate.mutateAsync({
        full_name: `${values.first_name} ${values.last_name}`.trim(),
        email: values.email || null,
        phone: values.phone || null,
        linkedin_url: values.linkedin_url || null,
        notes: values.notes || null,
        jobId: values.mode === "job" ? values.job_id : null,
        orgId: values.organization_id,
        cvFile: fileInput.current?.files?.[0] ?? null,
      });

      if (candidate.cvError) {
        toast.warning("Candidate added, but the CV could not be saved", {
          description: candidate.cvError,
        });
      } else {
        toast.success("Candidate added", {
          description:
            values.mode === "job"
              ? `${values.first_name} was added to the job's pipeline.`
              : `${values.first_name} was added to your talent pool.`,
        });
      }
      setOpen(false);
    } catch {
      // Error shown in the dialog.
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAll}>
      <DialogTrigger asChild>
        <Button disabled={!activeOrgId && !isAll}>
          <Plus />
          New candidate
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New candidate</DialogTitle>
          <DialogDescription>
            Add someone to your talent pool, and optionally to a job's pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            {/* Left: who */}
            <div className="space-y-4 md:border-r md:pr-8">
              <h3 className="text-sm font-semibold">Who is the candidate?</h3>

              {cvFileName ? (
                <div className="flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-sm">
                  {parseCv.isPending ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate" title={cvFileName}>
                    {cvFileName}
                  </span>
                  <button
                    type="button"
                    onClick={clearCv}
                    aria-label="Remove the attached CV"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <UploadCloud className="size-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-medium">Attach CV</span>{" "}
                    <span className="text-muted-foreground">to auto-fill the details</span>
                  </span>
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                aria-label="Attach CV to auto-fill"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCvFileName(file.name);
                    fillFromCv(file);
                  }
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField id="first_name" label="First name" error={errors.first_name?.message}>
                  <Input id="first_name" {...register("first_name")} />
                </FormField>
                <FormField id="last_name" label="Last name" error={errors.last_name?.message}>
                  <Input id="last_name" {...register("last_name")} />
                </FormField>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Contact <span className="font-normal text-muted-foreground">(at least one)</span>
                </p>
                <FormField id="email" label="Email" error={errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    {...register("email")}
                  />
                </FormField>
                <FormField id="phone" label="Phone" error={errors.phone?.message}>
                  <Input id="phone" placeholder="+46 70 123 45 67" {...register("phone")} />
                </FormField>
                <FormField
                  id="linkedin_url"
                  label="LinkedIn profile"
                  error={errors.linkedin_url?.message}
                >
                  <Input
                    id="linkedin_url"
                    placeholder="https://www.linkedin.com/in/…"
                    {...register("linkedin_url")}
                  />
                </FormField>
              </div>
            </div>

            {/* Right: which job */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">For which job or role?</h3>

              {isAll && (
                <FormField
                  id="organization_id"
                  label="Organization"
                  error={errors.organization_id?.message}
                >
                  <NativeSelect
                    id="organization_id"
                    {...register("organization_id")}
                    onChange={(e) => {
                      setValue("organization_id", e.target.value, { shouldValidate: true });
                      setValue("job_id", ""); // jobs belong to the organization
                    }}
                  >
                    <option value="">Select organization</option>
                    {organizations?.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              )}

              <div
                role="tablist"
                aria-label="Add to a job or the general pool"
                className="inline-flex rounded-md border p-0.5"
              >
                {(["job", "general"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => setValue("mode", value, { shouldValidate: true })}
                    className={cn(
                      "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                      mode === value
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {value === "job" ? "Job" : "General"}
                  </button>
                ))}
              </div>

              {mode === "job" ? (
                <FormField id="job_id" label="Job" error={errors.job_id?.message}>
                  <NativeSelect id="job_id" {...register("job_id")} disabled={jobsLoading}>
                    <option value="">{jobsLoading ? "Loading jobs…" : "Select job"}</option>
                    {openJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </NativeSelect>
                  {!jobsLoading && jobOrgId && openJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No open jobs. Switch to General, or open a job first.
                    </p>
                  )}
                </FormField>
              ) : (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Added to your talent pool without a job. You can place them on a job later.
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="flex gap-3 border-t pt-4">
            <Heart className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <label htmlFor="notes" className="text-sm font-medium">
                What else can you tell us?
              </label>
              <p className="text-xs text-muted-foreground">
                How do you know them? Why are they a good fit?
              </p>
              <Textarea id="notes" rows={3} className="mt-1" {...register("notes")} />
            </div>
          </div>

          {createCandidate.error && (
            <ErrorMessage
              message={`Could not add the candidate: ${createCandidate.error.message}`}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createCandidate.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCandidate.isPending}>
              {createCandidate.isPending && <Loader2 className="animate-spin" />}
              Add candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
