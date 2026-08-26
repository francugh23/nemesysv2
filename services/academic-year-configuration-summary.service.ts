import { hasThreeChronologicallyOrderedTerms } from "@/lib/academic-term";
import type { findAcademicYearConfigurationById } from "@/repositories/academic-year.repository";
import type { findShsElectiveEnrollmentPolicies } from "@/repositories/shs-elective-enrollment-policy.repository";
import type { findShsTermResultInterpretationPolicy } from "@/repositories/shs-term-result-interpretation-policy.repository";

export type AcademicYearReadinessNotice = {
  code:
    | "TERMS_NOT_ACTIVATABLE"
    | "NO_CURRICULUM"
    | "SHS_CURRICULUM_NOT_FINALIZABLE"
    | "MISSING_ELECTIVE_POLICIES"
    | "CURRICULUM_COUNT"
    | "REPRESENTED_GRADES"
    | "SCHOOL_APPROVED_SHS_CURRICULUM"
    | "ELECTIVE_POLICIES_CONFIGURED"
    | "RESULT_POLICY_STATUS";
  severity: "BLOCKER" | "WARNING" | "INFORMATION";
  message: string;
};

type AcademicYearConfigurationRecord = NonNullable<
  Awaited<ReturnType<typeof findAcademicYearConfigurationById>>
>;
type ElectivePolicyRecord = Awaited<
  ReturnType<typeof findShsElectiveEnrollmentPolicies>
>[number];
type InterpretationPolicyRecord = NonNullable<
  Awaited<ReturnType<typeof findShsTermResultInterpretationPolicy>>
>;

export function buildAcademicYearConfigurationSummary({
  academicYear,
  curriculum,
  electivePolicies,
  includeResultPolicy,
  resultPolicy,
}: {
  academicYear: AcademicYearConfigurationRecord;
  curriculum: {
    activeOfferingCount: number;
    gradeCounts: Array<{ gradeLevel: string; count: number }>;
    provisionalShsOfferingCount: number;
    pendingShsOfferingCount: number;
    schoolApprovedShsOfferingCount: number;
    controlledCorrectionCount: number;
  };
  electivePolicies: ElectivePolicyRecord[];
  includeResultPolicy: boolean;
  resultPolicy?: InterpretationPolicyRecord | null;
}) {
  const { terms, curriculumFinalization, ...overview } = academicYear;
  const termsReadyForActivation = hasThreeChronologicallyOrderedTerms(terms);
  const isDraft = overview.status === "DRAFT";
  const historical = overview.status === "LOCKED" || overview.status === "ARCHIVED";
  const expectedElectiveScopes = terms.flatMap((term) =>
    (["11", "12"] as const).map((gradeLevel) => ({
      academicTermId: term.id,
      termName: term.name,
      termPosition: term.position,
      gradeLevel,
    })),
  );
  const configuredScopeKeys = new Set(
    electivePolicies.map(
      (policy) => `${policy.academicTermId}:${policy.gradeLevel}`,
    ),
  );
  const missingScopes = expectedElectiveScopes.filter(
    (scope) =>
      !configuredScopeKeys.has(`${scope.academicTermId}:${scope.gradeLevel}`),
  );
  const notices: AcademicYearReadinessNotice[] = [];

  if (!termsReadyForActivation) {
    notices.push({
      code: "TERMS_NOT_ACTIVATABLE",
      severity: isDraft ? "BLOCKER" : "INFORMATION",
      message: isDraft
        ? "Configure exactly three chronological Terms before activating this Academic Year."
        : "This non-draft Academic Year does not have the three chronological Terms currently required for activation; its existing lifecycle state is unchanged.",
    });
  }

  if (curriculum.activeOfferingCount === 0) {
    notices.push({
      code: "NO_CURRICULUM",
      severity: historical ? "INFORMATION" : "WARNING",
      message: historical
        ? "No active Curriculum is recorded in this historical Academic Year."
        : "No active Curriculum is configured for this Academic Year.",
    });
  }

  if (curriculum.pendingShsOfferingCount > 0) {
    notices.push({
      code: "SHS_CURRICULUM_NOT_FINALIZABLE",
      severity: historical ? "INFORMATION" : isDraft ? "WARNING" : "BLOCKER",
      message: `${curriculum.pendingShsOfferingCount} active SHS Offering${curriculum.pendingShsOfferingCount === 1 ? " is" : "s are"} missing SHS context or Pending School Approval and must be completed, approved, or archived before Curriculum finalization.`,
    });
  }

  if (missingScopes.length > 0) {
    const missingScopeLabels = missingScopes.map(
      ({ gradeLevel, termName }) => `Grade ${gradeLevel} ${termName}`,
    );
    notices.push({
      code: "MISSING_ELECTIVE_POLICIES",
      severity: historical ? "INFORMATION" : "WARNING",
      message: `${missingScopes.length} SHS elective-policy scope${missingScopes.length === 1 ? " is" : "s are"} not configured: ${missingScopeLabels.join(", ")}.`,
    });
  }

  notices.push({
    code: "CURRICULUM_COUNT",
    severity: "INFORMATION",
    message: `${curriculum.activeOfferingCount} active Curriculum Offering${curriculum.activeOfferingCount === 1 ? "" : "s"} recorded.`,
  });

  if (curriculum.gradeCounts.length > 0) {
    notices.push({
      code: "REPRESENTED_GRADES",
      severity: "INFORMATION",
      message: `Curriculum represents Grade${curriculum.gradeCounts.length === 1 ? "" : "s"} ${curriculum.gradeCounts.map(({ gradeLevel }) => gradeLevel).join(", ")}.`,
    });
  }

  notices.push({
    code: "SCHOOL_APPROVED_SHS_CURRICULUM",
    severity: "INFORMATION",
    message: `${curriculum.schoolApprovedShsOfferingCount} school-approved SHS Offering${curriculum.schoolApprovedShsOfferingCount === 1 ? "" : "s"} recorded.`,
  });

  if (expectedElectiveScopes.length > 0 && missingScopes.length === 0) {
    notices.push({
      code: "ELECTIVE_POLICIES_CONFIGURED",
      severity: "INFORMATION",
      message: "SHS elective policies are configured for every current Term and Grade 11/12 scope.",
    });
  }

  if (includeResultPolicy) {
    notices.push({
      code: "RESULT_POLICY_STATUS",
      severity: "INFORMATION",
      message: resultPolicy
        ? `SHS result interpretation policy is ${resultPolicy.status}.`
        : "SHS result interpretation policy is not configured.",
    });
  }

  return {
    academicYear: {
      ...overview,
      curriculumFinalization: curriculumFinalization
        ? { finalizedAt: curriculumFinalization.finalizedAt }
        : null,
    },
    terms,
    activation: {
      termsReady: termsReadyForActivation,
      requiredTermCount: 3 as const,
    },
    curriculum: {
      activeOfferingCount: curriculum.activeOfferingCount,
      representedGrades: curriculum.gradeCounts.map(({ gradeLevel }) => gradeLevel),
      gradeCounts: curriculum.gradeCounts,
      provisionalShsOfferingCount: curriculum.provisionalShsOfferingCount,
      pendingShsOfferingCount: curriculum.pendingShsOfferingCount,
      schoolApprovedShsOfferingCount:
        curriculum.schoolApprovedShsOfferingCount,
      controlledCorrectionCount: curriculum.controlledCorrectionCount,
      state: historical
        ? "HISTORICAL" as const
        : curriculumFinalization
          ? "FINALIZED" as const
          : "CONFIGURABLE" as const,
      finalization: curriculumFinalization
        ? {
            finalizedAt: curriculumFinalization.finalizedAt,
            finalizedBy: [
              curriculumFinalization.finalizedBy.firstName,
              curriculumFinalization.finalizedBy.middleName,
              curriculumFinalization.finalizedBy.lastName,
            ].filter(Boolean).join(" "),
          }
        : null,
    },
    electivePolicies: {
      configuredScopeCount:
        expectedElectiveScopes.length - missingScopes.length,
      totalScopeCount: expectedElectiveScopes.length,
      missingScopes,
    },
    notices,
    ...(includeResultPolicy
      ? {
          resultInterpretationPolicy: resultPolicy
            ? {
                status: resultPolicy.status,
                passingThreshold: Number(resultPolicy.passingThreshold).toFixed(2),
                sourceReference: resultPolicy.sourceReference,
                publishedAt: resultPolicy.publishedAt,
              }
            : null,
        }
      : {}),
  };
}
