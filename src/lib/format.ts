const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "13 Oct 2026" */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Random password that is easy to read aloud: no 0/O or 1/l/I. */
export function generatePassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "14 Oct 2026, 21:14" (local time) */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
