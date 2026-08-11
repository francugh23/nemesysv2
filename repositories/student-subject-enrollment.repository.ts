import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

const studentSubjectEnrollmentSelect = {
  id: true,
  enrollmentId: true,
  subjectOfferingId: true,
  subjectCode: true,
  subjectDescription: true,
  gradeLevel: true,
  status: true,
  replacedAt: true,
  createdAt: true,
  updatedAt: true,
  terms: {
    select: {
      academicTermId: true,
      academicTerm: {
        select: { name: true, position: true },
      },
    },
    orderBy: { academicTerm: { position: "asc" } },
  },
} satisfies Prisma.StudentSubjectEnrollmentSelect;

export async function findStudentSubjectEnrollments(
  query: { enrollmentId: string; status?: "ACTIVE" | "REPLACED" },
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).studentSubjectEnrollment.findMany({
    where: query,
    select: studentSubjectEnrollmentSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function findActiveStudentSubjectEnrollmentByIdentity(
  enrollmentId: string,
  subjectOfferingId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).studentSubjectEnrollment.findFirst({
    where: { enrollmentId, subjectOfferingId, status: "ACTIVE" },
    select: { id: true },
  });
}
