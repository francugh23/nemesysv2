import type { Student } from "@/app/generated/prisma/client";

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
