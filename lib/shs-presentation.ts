import type {
  ShsCurriculumStatus,
  ShsSubjectClassification,
} from "@/app/generated/prisma/enums";

const classificationLabels: Record<ShsSubjectClassification, string> = {
  CORE: "Core",
  ACADEMIC_ELECTIVE: "Academic Elective",
  TECHPRO_ELECTIVE: "TechPro Elective",
};

const curriculumStatusLabels: Record<ShsCurriculumStatus, string> = {
  PROVISIONAL_DEPED: "Pending School Approval",
  SCHOOL_APPROVED: "School Approved",
};

export function getShsSubjectClassificationLabel(
  classification: ShsSubjectClassification,
) {
  return classificationLabels[classification];
}

export function getShsCurriculumStatusLabel(status: ShsCurriculumStatus) {
  return curriculumStatusLabels[status];
}
