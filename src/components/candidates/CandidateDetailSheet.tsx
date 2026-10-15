import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2, Mail, Pencil, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CvLink } from "@/components/candidates/CvLink";
import { ErrorMessage } from "@/components/common/StatusMessages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateCandidate, type CandidateWithApplications } from "@/hooks/useCandidates";
import { STAGES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const schema = z
  .object({
    full_name: z.string().trim().min(1, "Name is required").max(200, "Too long"),
    email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
    phone: z.string().trim().max(40, "Too long"),
    linkedin_url: z.union([
      z
        .string()
        .trim()
        .regex(/^https?:\/\//i, "Enter a full URL (https://…)"),
      z.literal(""),
    ]),
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
  });

type FormState = z.input<typeof schema>;
type ValidCandidate = z.output<typeof schema>;

const stageLabel = (stage: string) => STAGES.find((s) => s.value === stage)?.label ?? stage;

function toFormState(candidate: CandidateWithApplications): FormState {
  return {
    full_name: candidate.full_name,
    email: candidate.email ?? "",
    phone: candidate.phone ?? "",
    linkedin_url: candidate.linkedin_url ?? "",
    notes: candidate.notes ?? "",
  };
}

/**
 * Side sheet with a candidate's full profile: contact info, CV, the jobs
 * they're in the pipeline for (with stage), and notes — plus an inline
 * edit mode for their own fields (#17).
 */
export function CandidateDetailSheet({
  candidate,
  showOrganization,
  onOpenChange,
}: {
  /** null closes the sheet. */
  candidate: CandidateWithApplications | null;
  showOrganization: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Keep showing the last candidate while the sheet's close animation
  // plays (the parent sets `candidate` to null the moment it closes), and
  // pick up fresh field values whenever this candidate's row refetches.
  const [shown, setShown] = useState(candidate);
  const updateCandidate = useUpdateCandidate();

  useEffect(() => {
    if (candidate) setShown(candidate);
  }, [candidate]);

  // Leave edit mode (and clear any stale save error) whenever a different
  // candidate is opened, or the sheet closes — but not on a background
  // refetch of the same candidate (e.g. right after saving).
  useEffect(() => {
    setEditing(false);
    updateCandidate.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id]);

  const form = useForm<FormState, unknown, ValidCandidate>({
    resolver: zodResolver(schema),
    values: shown ? toFormState(shown) : undefined,
  });
  const { register, handleSubmit, formState } = form;
  const { errors } = formState;

  if (!shown) {
    return <Sheet open={false} onOpenChange={onOpenChange} />;
  }
  const candidateForView = shown;

  const linked = candidateForView.applications.filter((a) => a.job);

  const onSubmit = async (values: ValidCandidate) => {
    try {
      await updateCandidate.mutateAsync({
        id: candidateForView.id,
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null,
        linkedin_url: values.linkedin_url || null,
        notes: values.notes || null,
      });
      toast.success("Candidate updated");
      setEditing(false);
    } catch {
      // Error shown below the form.
    }
  };

  return (
    <Sheet open={!!candidate} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {editing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>Edit candidate</SheetTitle>
              <SheetDescription>Update their profile details.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 px-4">
              <FormField id="full_name" label="Full name" error={errors.full_name?.message}>
                <Input id="full_name" {...register("full_name")} />
              </FormField>
              <FormField id="email" label="Email" error={errors.email?.message}>
                <Input id="email" type="email" {...register("email")} />
              </FormField>
              <FormField id="phone" label="Phone" error={errors.phone?.message}>
                <Input id="phone" {...register("phone")} />
              </FormField>
              <FormField
                id="linkedin_url"
                label="LinkedIn profile"
                error={errors.linkedin_url?.message}
              >
                <Input id="linkedin_url" {...register("linkedin_url")} />
              </FormField>
              <FormField id="notes" label="Notes" error={errors.notes?.message}>
                <Textarea id="notes" rows={4} {...register("notes")} />
              </FormField>

              {updateCandidate.error && (
                <ErrorMessage message={`Could not save: ${updateCandidate.error.message}`} />
              )}
            </div>

            <SheetFooter className="flex-row justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset(toFormState(candidateForView));
                  updateCandidate.reset();
                  setEditing(false);
                }}
                disabled={updateCandidate.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateCandidate.isPending}>
                {updateCandidate.isPending && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{candidateForView.full_name}</SheetTitle>
              <SheetDescription>
                {showOrganization && candidateForView.organizationName
                  ? `${candidateForView.organizationName} · Added ${formatDate(candidateForView.created_at)}`
                  : `Added ${formatDate(candidateForView.created_at)}`}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 px-4">
              <section className="space-y-1.5">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Contact
                </h3>
                {candidateForView.email && (
                  <a
                    href={`mailto:${candidateForView.email}`}
                    className="flex items-center gap-1.5 text-sm hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    {candidateForView.email}
                  </a>
                )}
                {candidateForView.phone && (
                  <p className="flex items-center gap-1.5 text-sm">
                    <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                    {candidateForView.phone}
                  </p>
                )}
                {candidateForView.linkedin_url && (
                  <a
                    href={candidateForView.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    LinkedIn <ExternalLink className="size-3" />
                  </a>
                )}
                {candidateForView.cv_path && <CvLink path={candidateForView.cv_path} />}
                {!candidateForView.email &&
                  !candidateForView.phone &&
                  !candidateForView.linkedin_url && (
                    <p className="text-sm text-muted-foreground">No contact details.</p>
                  )}
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Pipeline
                </h3>
                {linked.length === 0 ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    Talent pool
                  </Badge>
                ) : (
                  <ul className="space-y-1.5">
                    {linked.map((a) => (
                      <li
                        key={a.job!.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
                      >
                        <span className="truncate" title={a.job!.title}>
                          {a.job!.title}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {stageLabel(a.stage)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Notes
                </h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {candidateForView.notes || "No notes yet."}
                </p>
              </section>
            </div>

            <SheetFooter className="flex-row justify-end">
              <SheetClose asChild>
                <Button variant="outline">Close</Button>
              </SheetClose>
              <Button onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
