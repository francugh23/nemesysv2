import type { Semester } from "@/app/generated/prisma/client";
import type { SubjectListItem } from "@/schemas";

export interface SubjectPage {
  items: SubjectListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface SubjectFilterOptions {
  gradeLevels: string[];
  trackStrands: string[];
  semesters: Semester[];
}
