export function formatDate(date?: Date | string | null): string {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(new Date(date));
}

export function formatFullName(
  first: string,
  middle?: string | null,
  last?: string | null,
) {
  const middleInitial = middle?.trim().charAt(0);

  return [last, first, middleInitial ? `${middleInitial}.` : null]
    .filter(Boolean)
    .join(" ");
}

export function displayValue(value?: string | null) {
  return value?.trim() || "—";
}

export function formatDateOnly(date?: Date | string | null): string {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(new Date(date));
}

export function formatDateTime(date?: Date | string | null): string {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
