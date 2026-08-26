import type {
  ShsCurriculumClusterTrack,
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

const curriculumClusterTrackLabels: Record<ShsCurriculumClusterTrack, string> = {
  ACADEMIC: "Academic",
  TECHPRO: "TechPro",
};

export function getShsSubjectClassificationLabel(
  classification: ShsSubjectClassification,
) {
  return classificationLabels[classification];
}

export function getShsCurriculumStatusLabel(status: ShsCurriculumStatus) {
  return curriculumStatusLabels[status];
}

export function getShsCurriculumClusterTrackLabel(
  track: ShsCurriculumClusterTrack,
) {
  return curriculumClusterTrackLabels[track];
}
