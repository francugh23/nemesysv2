import { auth } from "@/auth";
import { findNonArchivedEnrollments } from "@/repositories/enrollment.repository";
import type { EnrollmentListItem } from "@/schemas";

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }
}

export async function getEnrollments(): Promise<EnrollmentListItem[]> {
  await requireSuperAdmin();

  const enrollments = await findNonArchivedEnrollments();

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    studentId: enrollment.studentId,
    sectionId: enrollment.sectionId,
    studentLrn: enrollment.student.lrn,
    studentFirstName: enrollment.student.firstName,
    studentMiddleName: enrollment.student.middleName,
    studentLastName: enrollment.student.lastName,
    sectionGradeLevel: enrollment.section.gradeLevel,
    sectionTrackStrand: enrollment.section.trackStrand,
    sectionName: enrollment.section.sectionName,
    academicYear: enrollment.academicYear,
    semester: enrollment.semester,
    status: enrollment.status,
  }));
}
