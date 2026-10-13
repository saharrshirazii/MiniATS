import { PageHeader } from "@/components/layout/PageHeader";
import { STAGES } from "@/lib/constants";

// Placeholder board. Data, drag & drop and filters come in #18–#20.
export function KanbanPage() {
  return (
    <>
      <PageHeader title="Pipeline" description="All candidates across your jobs." />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <section
            key={stage.value}
            className="flex w-64 shrink-0 flex-col rounded-lg border bg-muted/40"
          >
            <h2 className="flex items-center justify-between px-3 py-2 text-sm font-medium">
              {stage.label}
              <span className="text-xs text-muted-foreground">0</span>
            </h2>
            <div className="min-h-40 flex-1 p-2" />
          </section>
        ))}
      </div>
    </>
  );
}
