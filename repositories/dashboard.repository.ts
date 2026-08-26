import { Prisma } from "@/app/generated/prisma/client";

const activeEnrollmentWhere = (academicYearId: string) => ({
  academicYearId,
  status: "ACTIVE" as const,
  deletedAt: null,
  student: { deletedAt: null, status: "ENROLLED" as const },
  section: { deletedAt: null },
});

export function findActiveAcademicYear(transaction: Prisma.TransactionClient) {
  return transaction.academicYear.findFirst({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      label: true,
      status: true,
      startDate: true,
      endDate: true,
      terms: {
        select: { id: true, name: true, position: true, startDate: true, endDate: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

export function countActiveTeachers(transaction: Prisma.TransactionClient) {
  return transaction.teacher.count({
    where: {
      deletedAt: null,
      user: { is: { deletedAt: null, status: "ACTIVE" } },
    },
  });
}

function countActiveDashboardSections(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT enrollment."sectionId")::int AS "count"
    FROM "Enrollment" enrollment
    INNER JOIN "Student" student ON student."id" = enrollment."studentId"
    INNER JOIN "Section" section ON section."id" = enrollment."sectionId"
    WHERE enrollment."academicYearId" = ${academicYearId}
      AND enrollment."status" = 'ACTIVE'::"EnrollmentStatus"
      AND enrollment."deletedAt" IS NULL
      AND student."deletedAt" IS NULL
      AND student."status" = 'ENROLLED'::"StudentStatus"
      AND section."deletedAt" IS NULL
  `).then((rows) => rows[0]?.count ?? 0);
}

function findActiveDashboardGradeCounts(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<Array<{ gradeLevel: string; count: number }>>(Prisma.sql`
    SELECT section."gradeLevel", COUNT(enrollment."id")::int AS "count"
    FROM "Enrollment" enrollment
    INNER JOIN "Student" student ON student."id" = enrollment."studentId"
    INNER JOIN "Section" section ON section."id" = enrollment."sectionId"
    WHERE enrollment."academicYearId" = ${academicYearId}
      AND enrollment."status" = 'ACTIVE'::"EnrollmentStatus"
      AND enrollment."deletedAt" IS NULL
      AND student."deletedAt" IS NULL
      AND student."status" = 'ENROLLED'::"StudentStatus"
      AND section."deletedAt" IS NULL
    GROUP BY section."gradeLevel"
  `);
}

export async function getStudentStatusSummary(transaction: Prisma.TransactionClient) {
  const groups = await transaction.student.groupBy({
    by: ["status"],
    where: {
      deletedAt: null,
      status: { in: ["ENROLLED", "UNENROLLED", "TRANSFERRED", "DROPPED"] },
    },
    _count: { _all: true },
  });
  const counts = new Map(groups.map(({ status, _count }) => [status, _count._all]));
  return {
    enrolled: counts.get("ENROLLED") ?? 0,
    unenrolled: counts.get("UNENROLLED") ?? 0,
    transferred: counts.get("TRANSFERRED") ?? 0,
    dropped: counts.get("DROPPED") ?? 0,
  };
}

export async function getOperationalDashboardAggregates(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const enrollmentWhere = activeEnrollmentWhere(academicYearId);
  const [activeEnrollmentCount, activeStudentCount, activeTeacherCount, activeSectionCount, gradeCounts, sectionGroups, activeOfferingCount, schoolApprovedShsOfferingCount, electivePolicies] = await Promise.all([
    transaction.enrollment.count({ where: enrollmentWhere }),
    transaction.enrollment.count({ where: enrollmentWhere }),
    countActiveTeachers(transaction),
    countActiveDashboardSections(academicYearId, transaction),
    findActiveDashboardGradeCounts(academicYearId, transaction),
    transaction.enrollment.groupBy({
      by: ["sectionId"],
      where: enrollmentWhere,
      _count: { _all: true },
      orderBy: [{ _count: { sectionId: "desc" } }, { sectionId: "asc" }],
      take: 10,
    }),
    transaction.subjectOffering.count({
      where: { academicYearId, deletedAt: null },
    }),
    transaction.subjectOffering.count({
      where: {
        academicYearId,
        deletedAt: null,
        gradeLevel: { in: ["11", "12"] },
        shsContext: { is: { curriculumStatus: "SCHOOL_APPROVED" } },
      },
    }),
    transaction.shsElectiveEnrollmentPolicy.findMany({
      where: { academicYearId },
      select: { academicTermId: true, gradeLevel: true },
    }),
  ]);

  const sections = sectionGroups.length
    ? await transaction.section.findMany({
        where: { id: { in: sectionGroups.map(({ sectionId }) => sectionId) }, deletedAt: null },
        select: { id: true, gradeLevel: true, trackStrand: true, sectionName: true },
      })
    : [];

  return {
    activeEnrollmentCount,
    activeStudentCount,
    activeTeacherCount,
    activeSectionCount,
    gradeCounts,
    activeOfferingCount,
    schoolApprovedShsOfferingCount,
    electivePolicies,
    sectionGroups,
    sections,
  };
}

export async function findDashboardSectionPage(
  academicYearId: string,
  page: number,
  transaction: Prisma.TransactionClient,
) {
  const enrollmentWhere = activeEnrollmentWhere(academicYearId);
  const pageSize = 25;
  const [total, groups] = await Promise.all([
    countActiveDashboardSections(academicYearId, transaction),
    transaction.enrollment.groupBy({
      by: ["sectionId"],
      where: enrollmentWhere,
      _count: { _all: true },
      orderBy: [{ _count: { sectionId: "desc" } }, { sectionId: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const sections = groups.length
    ? await transaction.section.findMany({
        where: { id: { in: groups.map(({ sectionId }) => sectionId) }, deletedAt: null },
        select: { id: true, gradeLevel: true, trackStrand: true, sectionName: true },
      })
    : [];
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  return {
    total,
    pageSize,
    records: groups.flatMap(({ sectionId, _count }) => {
      const section = sectionById.get(sectionId);
      return section ? [{
        id: section.id,
        gradeLevel: section.gradeLevel,
        label: [section.gradeLevel, section.trackStrand, section.sectionName].filter(Boolean).join(" - "),
        count: _count._all,
      }] : [];
    }),
  };
}

const resultWhere = (academicYearId: string) => ({
  studentSubjectEnrollmentTerm: {
    studentSubjectEnrollment: {
      status: "ACTIVE" as const,
      shsClassification: { not: null },
      enrollment: activeEnrollmentWhere(academicYearId),
    },
  },
});

export async function getDashboardResultData(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const where = resultWhere(academicYearId);
  const [draftCount, finalizedCount, revisedResultCount, revisions] = await Promise.all([
    transaction.shsTermResult.count({ where: { ...where, status: "DRAFT" } }),
    transaction.shsTermResult.count({ where: { ...where, status: "FINALIZED" } }),
    transaction.shsTermResult.count({ where: { ...where, revisions: { some: {} } } }),
    transaction.shsTermResultRevision.findMany({
      where: { shsTermResult: where },
      orderBy: [{ revisedAt: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        revisedAt: true,
        shsTermResult: {
          select: {
            studentSubjectEnrollmentTerm: {
              select: {
                studentSubjectEnrollment: { select: { subjectDescription: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return { draftCount, finalizedCount, revisedResultCount, revisions };
}

export async function findDashboardCorrections(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const select = {
    id: true,
    correctedAt: true,
    enrollment: {
      select: {
        student: { select: { firstName: true, middleName: true, lastName: true } },
      },
    },
  };
  const where = { enrollment: { academicYearId } };
  const [placements, gradePlacements, shsParticipations] = await Promise.all([
    transaction.studentEnrollmentCorrection.findMany({ where, orderBy: [{ correctedAt: "desc" }, { id: "desc" }], take: 8, select }),
    transaction.studentEnrollmentGradeCorrection.findMany({ where, orderBy: [{ correctedAt: "desc" }, { id: "desc" }], take: 8, select }),
    transaction.shsStudentParticipationCorrection.findMany({ where, orderBy: [{ correctedAt: "desc" }, { id: "desc" }], take: 8, select }),
  ]);

  return { placements, gradePlacements, shsParticipations };
}

export function findRecentDashboardAuditActivity(transaction: Prisma.TransactionClient) {
  return transaction.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 8,
    select: {
      id: true,
      action: true,
      module: true,
      description: true,
      createdAt: true,
      user: { select: { firstName: true, middleName: true, lastName: true } },
    },
  });
}
