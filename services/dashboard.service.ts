import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import { hasPermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
  countActiveTeachers,
  findActiveAcademicYear,
  findDashboardCorrections,
  findDashboardSectionPage,
  findRecentDashboardAuditActivity,
  getStudentStatusSummary,
  getDashboardResultData,
  getOperationalDashboardAggregates,
} from "@/repositories/dashboard.repository";
import type { DashboardReadModel } from "@/types/dashboard";

const gradeLevels = ["7", "8", "9", "10", "11", "12"] as const;

function fullName(person: { firstName: string; middleName: string | null; lastName: string }) {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}

export async function getOperationalDashboard(): Promise<DashboardReadModel> {
  const session = await requirePermission(Permissions.OPERATIONAL_DASHBOARD);
  const capabilities = {
    corrections: hasPermission(session.user.role, Permissions.STUDENT_CORRECTIONS),
    results: hasPermission(session.user.role, Permissions.GRADES),
    audit: hasPermission(session.user.role, Permissions.AUDIT_LOGS),
  };

  return prisma.$transaction(async (transaction) => {
    const activeAcademicYear = await findActiveAcademicYear(transaction);
    const studentStatusSummary = await getStudentStatusSummary(transaction);
    if (!activeAcademicYear) {
      return {
        state: "NO_ACTIVE_ACADEMIC_YEAR",
        capabilities,
        system: { activeTeacherCount: await countActiveTeachers(transaction), studentStatusSummary },
      };
    }

    const aggregates = await getOperationalDashboardAggregates(activeAcademicYear.id, transaction);
    const sectionById = new Map(aggregates.sections.map((section) => [section.id, section]));
    const gradeCounts = new Map(gradeLevels.map((gradeLevel) => [gradeLevel, 0]));
    for (const { gradeLevel, count } of aggregates.gradeCounts) {
      if (gradeCounts.has(gradeLevel as typeof gradeLevels[number])) {
        gradeCounts.set(gradeLevel as typeof gradeLevels[number], count);
      }
    }
    const sections = aggregates.sectionGroups.flatMap(({ sectionId, _count }) => {
      const section = sectionById.get(sectionId);
      if (!section) return [];
      return [{
        id: section.id,
        gradeLevel: section.gradeLevel,
        label: [section.gradeLevel, section.trackStrand, section.sectionName].filter(Boolean).join(" - "),
        count: _count._all,
      }];
    }).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

    const termsReady = activeAcademicYear.terms.length === 3 && activeAcademicYear.terms.every((term, index, terms) => {
      const previousTerm = terms[index - 1];
      return term.position === index + 1 && term.startDate <= term.endDate && (!previousTerm || previousTerm.endDate < term.startDate);
    });
    const configuredScopes = new Set(aggregates.electivePolicies.map((policy) => `${policy.academicTermId}:${policy.gradeLevel}`));
    const missingScopes = activeAcademicYear.terms.flatMap((term) => ["11", "12"].flatMap((gradeLevel) =>
      configuredScopes.has(`${term.id}:${gradeLevel}`) ? [] : [{ termName: term.name, gradeLevel }],
    ));
    const [resultData, corrections, auditActivity] = await Promise.all([
      capabilities.results ? getDashboardResultData(activeAcademicYear.id, transaction) : undefined,
      capabilities.corrections ? findDashboardCorrections(activeAcademicYear.id, transaction) : undefined,
      capabilities.audit ? findRecentDashboardAuditActivity(transaction) : undefined,
    ]);

    return {
      state: "READY",
      capabilities,
      system: { studentStatusSummary },
      academicYear: {
        id: activeAcademicYear.id,
        label: activeAcademicYear.label,
        status: "ACTIVE",
        startDate: activeAcademicYear.startDate.toISOString(),
        endDate: activeAcademicYear.endDate.toISOString(),
      },
      summary: {
        activeStudentCount: aggregates.activeStudentCount,
        activeEnrollmentCount: aggregates.activeEnrollmentCount,
        activeTeacherCount: aggregates.activeTeacherCount,
        activeSectionCount: aggregates.activeSectionCount,
        jhsEnrollmentCount: gradeLevels.slice(0, 4).reduce((total, gradeLevel) => total + (gradeCounts.get(gradeLevel) ?? 0), 0),
        shsEnrollmentCount: gradeLevels.slice(4).reduce((total, gradeLevel) => total + (gradeCounts.get(gradeLevel) ?? 0), 0),
        activeOfferingCount: aggregates.activeOfferingCount,
        schoolApprovedShsOfferingCount: aggregates.schoolApprovedShsOfferingCount,
      },
      distributions: {
        grades: gradeLevels.map((gradeLevel) => ({ gradeLevel, count: gradeCounts.get(gradeLevel) ?? 0 })),
        topSections: sections,
      },
      curriculumReadiness: {
        activeOfferingCount: aggregates.activeOfferingCount,
        schoolApprovedShsOfferingCount: aggregates.schoolApprovedShsOfferingCount,
        missingElectivePolicies: termsReady
          ? { state: "READY", missingScopes }
          : { state: "NOT_DETERMINABLE", message: "Configure exactly three ordered Terms before evaluating SHS elective-policy scopes." },
        warnings: [
          ...(aggregates.activeOfferingCount === 0 ? ["No active Curriculum Offerings are configured for this Academic Year."] : []),
          ...(!termsReady ? ["Academic Year Terms are incomplete or out of order."] : []),
        ],
      },
      ...(resultData ? {
        resultSummary: {
          draftCount: resultData.draftCount,
          finalizedCount: resultData.finalizedCount,
          revisedResultCount: resultData.revisedResultCount,
        },
        recentResultRevisions: resultData.revisions.map((revision) => ({
          id: revision.id,
          subjectDescription: revision.shsTermResult.studentSubjectEnrollmentTerm.studentSubjectEnrollment.subjectDescription,
          revisedAt: revision.revisedAt.toISOString(),
        })),
      } : {}),
      ...(corrections ? {
        recentCorrections: [
          ...corrections.placements.map((correction) => ({ ...correction, kind: "PLACEMENT" as const })),
          ...corrections.gradePlacements.map((correction) => ({ ...correction, kind: "GRADE_PLACEMENT" as const })),
          ...corrections.shsParticipations.map((correction) => ({ ...correction, kind: "SHS_PARTICIPATION" as const })),
        ].sort((left, right) => right.correctedAt.getTime() - left.correctedAt.getTime()).slice(0, 8).map((correction) => ({
          id: correction.id,
          kind: correction.kind,
          studentName: fullName(correction.enrollment.student),
          correctedAt: correction.correctedAt.toISOString(),
        })),
      } : {}),
      ...(auditActivity ? {
        recentAuditActivity: auditActivity.map((activity) => ({
          id: activity.id,
          action: activity.action,
          module: activity.module,
          description: activity.description,
          createdAt: activity.createdAt.toISOString(),
          actorName: fullName(activity.user),
        })),
      } : {}),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getOperationalDashboardSectionPage(page: number) {
  await requirePermission(Permissions.OPERATIONAL_DASHBOARD);

  return prisma.$transaction(async (transaction) => {
    const activeAcademicYear = await findActiveAcademicYear(transaction);
    if (!activeAcademicYear) {
      return { state: "NO_ACTIVE_ACADEMIC_YEAR", total: 0, records: [] } as const;
    }

    const sectionPage = await findDashboardSectionPage(activeAcademicYear.id, page, transaction);
    return { state: "READY", total: sectionPage.total, records: sectionPage.records } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
