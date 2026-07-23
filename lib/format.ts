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