import type { EnrollmentShsTrack } from "@/app/generated/prisma/client";

export function getEnrollmentFoundationValidationError(input: {
  academicYearId: string;
  entryAcademicTerm: { academicYearId: string } | null;
  gradeLevel: string;
  shsTrack?: EnrollmentShsTrack;
}) {
  const isShs = input.gradeLevel === "11" || input.gradeLevel === "12";
  if (isShs) {
    if (!input.entryAcademicTerm) {
      return "Entry Academic Term is required for Grade 11 and 12 enrollments.";
    }
    if (input.entryAcademicTerm.academicYearId !== input.academicYearId) {
      return "Entry Academic Term must belong to the selected Academic Year.";
    }
    if (!input.shsTrack) {
      return "SHS Track is required for Grade 11 and 12 enrollments.";
    }
  }
  if (!isShs && (input.entryAcademicTerm || input.shsTrack)) {
    return "JHS enrollments cannot have an entry Academic Term or SHS Track.";
  }

  return null;
}

export function getEnrollmentPlacementCompatibilityError(input: {
  destinationGradeLevel: string;
  entryAcademicTermId: string | null;
  shsTrack: EnrollmentShsTrack | null;
}) {
  const destinationIsShs =
    input.destinationGradeLevel === "11" ||
    input.destinationGradeLevel === "12";

  if (input.shsTrack && !destinationIsShs) {
    return "Placement cannot move an Enrollment with an SHS Track to a JHS grade.";
  }
  if (destinationIsShs && (!input.entryAcademicTermId || !input.shsTrack)) {
    return "Placement cannot move an Enrollment to SHS without an entry Term and SHS Track.";
  }

  return null;
}
