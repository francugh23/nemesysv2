import type {
  Gender,
  Student,
  StudentStatus,
} from "@/app/generated/prisma/client";

export type StudentListItem = Student & {
  currentSection: {
    id: string;
    gradeLevel: string;
    trackStrand: string | null;
    sectionName: string;
    room: string | null;
    shift: "MORNING" | "AFTERNOON" | null;
    adviser: {
      user: {
        firstName: string;
        middleName: string | null;
        lastName: string;
      };
    } | null;
  } | null;
};

export interface StudentPage {
  items: StudentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface StudentFilterOptions {
  statuses: StudentStatus[];
  genders: Gender[];
  gradeLevels: string[];
  sections: Array<{
    id: string;
    gradeLevel: string;
    trackStrand: string | null;
    sectionName: string;
  }>;
}
