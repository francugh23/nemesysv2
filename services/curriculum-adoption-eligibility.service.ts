import { isJhsGradeLevel } from "@/lib/subject-identity";
import type { CurriculumAdoptionOffering } from "@/repositories/curriculum-adoption.repository";

export type CurriculumAdoptionReason = { code: string; message: string };

export function getCurriculumAdoptionInvalidReasons(
  offering: CurriculumAdoptionOffering,
): CurriculumAdoptionReason[] {
  const reasons: CurriculumAdoptionReason[] = [];

  if (offering.subject.deletedAt) {
    reasons.push({ code: "SUBJECT_ARCHIVED", message: "The related Subject is archived." });
  }
  if (offering.subject.gradeLevel !== offering.gradeLevel) {
    reasons.push({
      code: "SUBJECT_GRADE_MISMATCH",
      message: "The Offering grade does not match its reusable Subject definition.",
    });
  }

  if (isJhsGradeLevel(offering.gradeLevel)) {
    if (offering.shsContext) {
      reasons.push({
        code: "INVALID_SHS_CONTEXT",
        message: "A JHS Offering cannot have an SSHS context.",
      });
    }
    return reasons;
  }

  const context = offering.shsContext;
  if (!context) {
    reasons.push({
      code: "MISSING_SHS_CONTEXT",
      message: "The SSHS Offering has no SSHS context.",
    });
    return reasons;
  }
  if (!context.sourceReference?.trim()) {
    reasons.push({
      code: "MISSING_SOURCE_REFERENCE",
      message: "The SSHS context has no valid source reference.",
    });
  }
  if (context.classification === "CORE") {
    if (context.clusterId) {
      reasons.push({
        code: "INVALID_SHS_CLUSTER",
        message: "A Core SSHS Offering cannot have a curriculum cluster.",
      });
    }
    return reasons;
  }
  if (!context.cluster) {
    reasons.push({
      code: "MISSING_SHS_CLUSTER",
      message: "The SSHS elective has no curriculum cluster.",
    });
    return reasons;
  }
  if (context.cluster.deletedAt) {
    reasons.push({
      code: "SHS_CLUSTER_ARCHIVED",
      message: "The related SSHS curriculum cluster is archived.",
    });
  }
  if (!context.cluster.isSchoolFacing) {
    reasons.push({
      code: "SHS_CLUSTER_NOT_SCHOOL_FACING",
      message:
        "The related SSHS curriculum cluster is source-only and cannot be used by operational Curriculum.",
    });
  }
  const expectedTrack =
    context.classification === "ACADEMIC_ELECTIVE" ? "ACADEMIC" : "TECHPRO";
  if (context.cluster.track !== expectedTrack) {
    reasons.push({
      code: "INVALID_SHS_CLUSTER_TRACK",
      message: `The SSHS curriculum cluster must use the ${expectedTrack} track.`,
    });
  }

  return reasons;
}
