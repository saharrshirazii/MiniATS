/**
 * Tailwind classes for a small AI-score badge, colored by how strong the
 * fit looks — a quick visual cue, nothing more. The AI is advisory only:
 * this never changes a card's stage or any other data on its own.
 */
export function scoreBadgeClass(score: number): string {
  if (score >= 75) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 50) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}
