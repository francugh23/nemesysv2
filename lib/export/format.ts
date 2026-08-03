const PHILIPPINE_TIME_ZONE = "Asia/Manila";

function getDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function formatExportDate(value: Date | string) {
  const { year, month, day } = getDateParts(new Date(value));

  return `${year}-${month}-${day}`;
}

export function formatExportDateTime(value: Date | string) {
  const { year, month, day, hour, minute, second } = getDateParts(
    new Date(value),
  );

  return `${year}-${month}-${day} ${hour}:${minute}:${second} PHT`;
}

export function createExportFileName(
  fileSlug: string,
  format: "csv" | "xlsx",
  generatedAt = new Date(),
) {
  const { year, month, day, hour, minute, second } = getDateParts(generatedAt);
  const safeSlug = fileSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `nemesys-${safeSlug}-${year}${month}${day}-${hour}${minute}${second}-PHT.${format}`;
}

export function neutralizeSpreadsheetFormula(value: string) {
  return /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function formatExportEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
