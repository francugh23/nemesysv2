export const SUBJECT_GRADE_LEVELS = ["7", "8", "9", "10", "11", "12"] as const;

export type SubjectGradeLevel = (typeof SUBJECT_GRADE_LEVELS)[number];

export interface SubjectIdentity {
  code: string;
  gradeLevel: string;
}

interface SubjectIdentityInput {
  code: string;
  gradeLevel: string;
}

export function isJhsGradeLevel(gradeLevel: string) {
  return ["7", "8", "9", "10"].includes(gradeLevel);
}

export function normalizeSubjectIdentity({
  code,
  gradeLevel,
}: SubjectIdentityInput) {
  return {
    code: code.trim().toUpperCase(),
    gradeLevel: gradeLevel.trim(),
  };
}

export function getSubjectIdentityKey(identity: SubjectIdentity) {
  return [identity.code, identity.gradeLevel].join("\u0000");
}
