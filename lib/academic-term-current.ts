export const ACADEMIC_CALENDAR_TIME_ZONE = "Asia/Manila";

type AcademicTermCalendar = {
  id: string;
  startDate: Date;
  endDate: Date;
};

type ActiveAcademicYearCalendar = {
  id: string;
  status: string;
  terms: AcademicTermCalendar[];
};

export class CurrentAcademicTermConfigurationError extends Error {}

export function getPhilippineCalendarDate(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACADEMIC_CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function resolveCurrentAcademicTerm(
  academicYears: ActiveAcademicYearCalendar[],
  clock: () => Date = () => new Date(),
) {
  const activeYears = academicYears.filter(({ status }) => status === "ACTIVE");
  if (activeYears.length > 1) {
    throw new CurrentAcademicTermConfigurationError(
      "Multiple active academic years prevent current Term resolution.",
    );
  }
  const academicYear = activeYears[0];
  if (!academicYear) return null;

  const operationalDate = getPhilippineCalendarDate(clock());
  const matchingTerms = academicYear.terms.filter(
    ({ startDate, endDate }) =>
      toDateOnly(startDate) <= operationalDate &&
      operationalDate <= toDateOnly(endDate),
  );
  if (matchingTerms.length > 1) {
    throw new CurrentAcademicTermConfigurationError(
      "Multiple Academic Terms match the Philippine operational date.",
    );
  }
  return matchingTerms[0]
    ? { academicYear, academicTerm: matchingTerms[0], operationalDate }
    : null;
}
