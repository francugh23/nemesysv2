import type { AcademicYearStatus } from "@/app/generated/prisma/client";

export function isAcademicYearWritable(status: AcademicYearStatus) {
  return status === "ACTIVE";
}
