import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number; // 1-based
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** Noun for the summary, e.g. "jobs" → "Showing 1–10 of 23 jobs". */
  itemLabel?: string;
};

/** Page numbers to show: all if few, otherwise first, last and neighbours with gaps. */
function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  itemLabel = "items",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted-foreground">
        Showing {from}–{to} of {totalItems} {itemLabel}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
            Previous
          </Button>

          {pageNumbers(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="sm"
                className="min-w-8"
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Button>
            ),
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  );
}
