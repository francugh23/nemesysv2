import { Prisma, type StudentStatus } from "@/app/generated/prisma/client";
import {
  findLatestActiveEnrollmentByStudent,
  findLatestTerminalEnrollmentByStudent,
} from "@/repositories/enrollment.repository";
import { updateStudentEnrollmentSummary } from "@/repositories/student.repository";

export async function synchronizeStudentFromEnrollments(
  studentId: string,
  transaction: Prisma.TransactionClient,
) {
  const activeEnrollment = await findLatestActiveEnrollmentByStudent(studentId, transaction);
  let status: StudentStatus = "ENROLLED";
  let currentSectionId: string | null = activeEnrollment?.sectionId ?? null;
  let currentSection = activeEnrollment?.section ?? null;

  if (!activeEnrollment) {
    const terminalEnrollment = await findLatestTerminalEnrollmentByStudent(studentId, transaction);
    currentSectionId = null;
    currentSection = null;
    if (terminalEnrollment?.status === "TRANSFERRED") status = "TRANSFERRED";
    else if (terminalEnrollment?.status === "DROPPED") status = "DROPPED";
    else if (!terminalEnrollment || terminalEnrollment.status !== "COMPLETED") status = "UNENROLLED";
  }

  await updateStudentEnrollmentSummary(studentId, { status, currentSectionId }, transaction);
  return { status, currentSectionId, currentSection };
}
