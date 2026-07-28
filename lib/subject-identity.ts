export const SUBJECT_GRADE_LEVELS = ["7", "8", "9", "10", "11", "12"] as const;

export type SubjectGradeLevel = (typeof SUBJECT_GRADE_LEVELS)[number];

interface SubjectIdentityInput {
  code: string;
  gradeLevel: string;
  trackStrand?: string | null;
}

export function isJhsGradeLevel(gradeLevel: string) {
  return ["7", "8", "9", "10"].includes(gradeLevel);
}

export function normalizeSubjectIdentity({
  code,
  gradeLevel,
  trackStrand,
}: SubjectIdentityInput) {
  const normalizedTrackStrand = trackStrand?.trim().toUpperCase();

  return {
    code: code.trim().toUpperCase(),
    gradeLevel: gradeLevel.trim(),
    trackStrand: normalizedTrackStrand || null,
  };
}
