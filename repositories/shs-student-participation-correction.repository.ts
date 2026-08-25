import { randomUUID } from "node:crypto";

import { Prisma } from "@/app/generated/prisma/client";

export type LockedShsParticipationCorrectionEnrollment = {
  id: string;
  studentId: string;
  academicYearId: string;
  status: string;
  deletedAt: Date | null;
  entryAcademicTermId: string | null;
  shsTrack: string | null;
  gradeLevel: string;
  academicYearStatus: string;
};

export type LockedShsParticipationCorrectionSse = {
  id: string;
  enrollmentId: string;
  subjectOfferingId: string;
  selectionAcademicTermId: string | null;
  subjectCode: string;
  subjectDescription: string;
  gradeLevel: string;
  shsClassification: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE" | null;
  shsClusterCode: string | null;
  shsClusterName: string | null;
  shsCurriculumStatus: string | null;
  shsSourceReference: string | null;
  shsApprovalReference: string | null;
  status: string;
  terms: Array<{ academicTermId: string; academicYearId: string; position: number; endDate: Date; resultId: string | null; resultStatus: string | null }>;
};

export type LockedShsParticipationCorrectionOffering = {
  id: string;
  academicYearId: string;
  gradeLevel: string;
  subjectCode: string;
  subjectDescription: string;
  deletedAt: Date | null;
  classification: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE" | null;
  curriculumStatus: string | null;
  sourceReference: string | null;
  approvalReference: string | null;
  clusterId: string | null;
  clusterCode: string | null;
  clusterName: string | null;
  clusterDeletedAt: Date | null;
  terms: Array<{ academicTermId: string; position: number }>;
};

export async function findShsParticipationCorrectionReference(enrollmentId: string, transaction: Prisma.TransactionClient) {
  const rows = await transaction.$queryRaw<Array<{ studentId: string }>>(Prisma.sql`
    SELECT "studentId" FROM "Enrollment" WHERE "id" = ${enrollmentId} FOR SHARE
  `);
  return rows[0] ?? null;
}

export async function lockShsParticipationCorrectionEnrollment(enrollmentId: string, transaction: Prisma.TransactionClient) {
  const rows = await transaction.$queryRaw<LockedShsParticipationCorrectionEnrollment[]>(Prisma.sql`
    SELECT enrollment."id", enrollment."studentId", enrollment."academicYearId", enrollment."status",
      enrollment."deletedAt", enrollment."entryAcademicTermId", enrollment."shsTrack",
      section."gradeLevel", academic_year."status" AS "academicYearStatus"
    FROM "Enrollment" enrollment
    JOIN "Section" section ON section."id" = enrollment."sectionId"
    JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
    WHERE enrollment."id" = ${enrollmentId}
    FOR UPDATE OF enrollment
  `);
  return rows[0] ?? null;
}

export async function lockShsParticipationCorrectionAcademicYear(academicYearId: string, transaction: Prisma.TransactionClient) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "AcademicYear" WHERE "id" = ${academicYearId} FOR SHARE
  `);
  return rows[0] ?? null;
}

export async function lockShsParticipationCorrectionSource(
  sourceStudentSubjectEnrollmentId: string,
  transaction: Prisma.TransactionClient,
): Promise<LockedShsParticipationCorrectionSse | null> {
  const rows = await transaction.$queryRaw<Array<Omit<LockedShsParticipationCorrectionSse, "terms">>>(Prisma.sql`
    SELECT "id", "enrollmentId", "subjectOfferingId", "selectionAcademicTermId", "subjectCode", "subjectDescription",
      "gradeLevel", "shsClassification", "shsClusterCode", "shsClusterName", "shsCurriculumStatus",
      "shsSourceReference", "shsApprovalReference", "status"
    FROM "StudentSubjectEnrollment" WHERE "id" = ${sourceStudentSubjectEnrollmentId} FOR UPDATE
  `);
  const source = rows[0];
  if (!source) return null;
  const memberships = await transaction.$queryRaw<Array<{ academicTermId: string; academicYearId: string; position: number; endDate: Date }>>(Prisma.sql`
    SELECT membership."academicTermId", term."academicYearId", term."position", term."endDate"
    FROM "StudentSubjectEnrollmentTerm" membership
    JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
    WHERE membership."studentSubjectEnrollmentId" = ${source.id}
    ORDER BY term."position", membership."academicTermId"
    FOR UPDATE OF membership
  `);
  const results = await transaction.$queryRaw<Array<{ id: string; academicTermId: string; status: string }>>(Prisma.sql`
    SELECT "id", "academicTermId", "status" FROM "ShsTermResult"
    WHERE "studentSubjectEnrollmentId" = ${source.id}
    ORDER BY "academicTermId", "id" FOR UPDATE
  `);
  return {
    ...source,
    terms: memberships.map((term) => {
      const result = results.find(({ academicTermId }) => academicTermId === term.academicTermId);
      return { ...term, resultId: result?.id ?? null, resultStatus: result?.status ?? null };
    }),
  };
}

export async function lockShsParticipationCorrectionOffering(
  offeringId: string,
  transaction: Prisma.TransactionClient,
): Promise<LockedShsParticipationCorrectionOffering | null> {
  const offerings = await transaction.$queryRaw<Array<{ id: string; academicYearId: string; gradeLevel: string; subjectCode: string; subjectDescription: string; deletedAt: Date | null }>>(Prisma.sql`
    SELECT "id", "academicYearId", "gradeLevel", "subjectCode", "subjectDescription", "deletedAt"
    FROM "SubjectOffering" WHERE "id" = ${offeringId} FOR UPDATE
  `);
  const base = offerings[0];
  if (!base) return null;
  const contexts = await transaction.$queryRaw<Array<{ classification: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE"; curriculumStatus: string; sourceReference: string | null; approvalReference: string | null; clusterId: string | null }>>(Prisma.sql`
    SELECT "classification", "curriculumStatus", "sourceReference", "approvalReference", "clusterId"
    FROM "SubjectOfferingShsContext" WHERE "subjectOfferingId" = ${base.id} FOR UPDATE
  `);
  const context = contexts[0];
  const clusters = context?.clusterId ? await transaction.$queryRaw<Array<{ id: string; code: string; name: string; deletedAt: Date | null }>>(Prisma.sql`
    SELECT "id", "code", "name", "deletedAt" FROM "ShsCurriculumCluster" WHERE "id" = ${context.clusterId} FOR UPDATE
  `) : [];
  const cluster = clusters[0] ?? null;
  const offering = {
    ...base,
    classification: context?.classification ?? null,
    curriculumStatus: context?.curriculumStatus ?? null,
    sourceReference: context?.sourceReference ?? null,
    approvalReference: context?.approvalReference ?? null,
    clusterId: context?.clusterId ?? null,
    clusterCode: cluster?.code ?? null,
    clusterName: cluster?.name ?? null,
    clusterDeletedAt: cluster?.deletedAt ?? null,
  };
  const terms = await transaction.$queryRaw<LockedShsParticipationCorrectionOffering["terms"]>(Prisma.sql`
    SELECT membership."academicTermId", term."position"
    FROM "SubjectOfferingTerm" membership JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
    WHERE membership."subjectOfferingId" = ${offering.id}
    ORDER BY term."position", membership."academicTermId" FOR SHARE OF membership, term
  `);
  return { ...offering, terms };
}

export async function lockShsParticipationCorrectionPolicy(
  academicYearId: string,
  academicTermId: string,
  gradeLevel: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string; minimumElectives: number; maximumElectives: number }>>(Prisma.sql`
    SELECT "id", "minimumElectives", "maximumElectives" FROM "ShsElectiveEnrollmentPolicy"
    WHERE "academicYearId" = ${academicYearId} AND "academicTermId" = ${academicTermId} AND "gradeLevel" = ${gradeLevel}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function lockShsParticipationCorrectionConflicts(enrollmentId: string, transaction: Prisma.TransactionClient) {
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "ShsStudentParticipationCorrection" WHERE "enrollmentId" = ${enrollmentId} ORDER BY "id" FOR SHARE
  `);
}

export async function findShsParticipationCorrectionHistory(enrollmentId: string, transaction: Prisma.TransactionClient) {
  return transaction.studentSubjectEnrollment.findMany({
    where: { enrollmentId, shsCurriculumStatus: { not: null } },
    select: { id: true, subjectOfferingId: true, status: true, shsClassification: true, selectionAcademicTermId: true, terms: { select: { academicTermId: true } } },
    orderBy: { id: "asc" },
  });
}

export function setShsParticipationCorrectionCapability(correctionId: string, transaction: Prisma.TransactionClient) {
  return transaction.$queryRaw<Array<{ set_config: string }>>`
    SELECT set_config('nemesys.shs_student_participation_correction_id', ${correctionId}, true)
  `;
}

export async function executeShsParticipationCorrection(
  data: {
    enrollmentId: string;
    sourceStudentSubjectEnrollmentId: string;
    sourceAcademicTermId: string;
    replacementSubjectOfferingId: string;
    reason: string;
    evidenceReference: string;
    actorId: string;
    correctionId: string;
  },
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{
    correctionId: string;
    replacementStudentSubjectEnrollmentId: string;
  }>>(Prisma.sql`
    SELECT * FROM "ShsStudentParticipationCorrection_execute"(
      ${data.enrollmentId}, ${data.sourceStudentSubjectEnrollmentId}, ${data.sourceAcademicTermId},
      ${data.replacementSubjectOfferingId}, ${data.reason}, ${data.evidenceReference}, ${data.actorId},
      ${data.correctionId}, ${randomUUID()}, ${randomUUID()}, ${randomUUID()}
    )
  `);
  return rows[0] ?? null;
}

export async function createShsParticipationCorrectionReplacement(
  enrollmentId: string,
  offering: LockedShsParticipationCorrectionOffering,
  academicTermIds: string[],
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const id = randomUUID();
  const rows = await transaction.$queryRaw<Array<{ id: string; subjectOfferingId: string }>>(Prisma.sql`
    WITH created AS (
      INSERT INTO "StudentSubjectEnrollment" (
        "id", "enrollmentId", "subjectOfferingId", "selectionAcademicTermId",
        "subjectCode", "subjectDescription", "gradeLevel", "shsClassification",
        "shsClusterCode", "shsClusterName", "shsCurriculumStatus", "shsSourceReference",
        "shsApprovalReference", "status", "createdById", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${enrollmentId}, ${offering.id}, ${offering.classification === "CORE" ? null : academicTermIds[0]},
        ${offering.subjectCode}, ${offering.subjectDescription}, ${offering.gradeLevel},
        ${offering.classification!}::"ShsSubjectClassification", ${offering.clusterCode}, ${offering.clusterName},
        ${offering.curriculumStatus as "SCHOOL_APPROVED"}::"ShsCurriculumStatus", ${offering.sourceReference},
        ${offering.approvalReference}, 'ACTIVE', ${actorId}, NOW(), NOW()
      ) RETURNING "id", "subjectOfferingId"
    ), memberships AS (
      INSERT INTO "StudentSubjectEnrollmentTerm" ("studentSubjectEnrollmentId", "academicTermId")
      SELECT created."id", term_scope."academicTermId"
      FROM created CROSS JOIN (VALUES ${Prisma.join(academicTermIds.map((academicTermId) => Prisma.sql`(${academicTermId})`))}) AS term_scope("academicTermId")
    )
    SELECT "id", "subjectOfferingId" FROM created
  `);
  return rows[0]!;
}

export async function replaceShsParticipationCorrectionSource(
  sourceStudentSubjectEnrollmentId: string,
  replacedAt: Date,
  transaction: Prisma.TransactionClient,
) {
  const result = await transaction.studentSubjectEnrollment.updateMany({
    where: { id: sourceStudentSubjectEnrollmentId, status: "ACTIVE" },
    data: { status: "REPLACED", replacedAt },
  });
  return result.count === 1;
}

export function createShsParticipationCorrection(
  data: {
    id: string; enrollmentId: string; sourceStudentSubjectEnrollmentId: string; sourceAcademicTermId: string;
    replacementStudentSubjectEnrollmentId: string; replacementAcademicTermId: string;
    kind: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE"; reason: string; evidenceReference: string;
    sourceParticipationSnapshot: Prisma.InputJsonValue; replacementParticipationSnapshot: Prisma.InputJsonValue;
    plannedTermScopeSnapshot: Prisma.InputJsonValue; sourceResultStateSnapshot: Prisma.InputJsonValue;
    correctedById: string; correctedAt: Date;
  },
  transaction: Prisma.TransactionClient,
) {
  return transaction.$executeRaw(Prisma.sql`
    INSERT INTO "ShsStudentParticipationCorrection" (
      "id", "enrollmentId", "sourceStudentSubjectEnrollmentId", "sourceAcademicTermId",
      "replacementStudentSubjectEnrollmentId", "replacementAcademicTermId", "kind", "reason", "evidenceReference",
      "sourceParticipationSnapshot", "replacementParticipationSnapshot", "plannedTermScopeSnapshot", "sourceResultStateSnapshot",
      "correctedById", "correctedAt", "createdAt"
    ) VALUES (
      ${data.id}, ${data.enrollmentId}, ${data.sourceStudentSubjectEnrollmentId}, ${data.sourceAcademicTermId},
      ${data.replacementStudentSubjectEnrollmentId}, ${data.replacementAcademicTermId}, ${data.kind}::"ShsStudentParticipationCorrectionKind", ${data.reason}, ${data.evidenceReference},
      ${JSON.stringify(data.sourceParticipationSnapshot)}::jsonb, ${JSON.stringify(data.replacementParticipationSnapshot)}::jsonb,
      ${JSON.stringify(data.plannedTermScopeSnapshot)}::jsonb, ${JSON.stringify(data.sourceResultStateSnapshot)}::jsonb,
      ${data.correctedById}, ${data.correctedAt}, ${data.correctedAt}
    )
  `);
}

export function forceShsParticipationCorrectionValidation(transaction: Prisma.TransactionClient) {
  return transaction.$executeRawUnsafe(
    'SET CONSTRAINTS "ShsStudentParticipationCorrection_completion_trigger", "ShsStudentParticipationCorrection_revalidation_trigger", "ShsStudentParticipationCorrection_term_revalidation_trigger", "ShsStudentParticipationCorrection_result_revalidation_trigger" IMMEDIATE',
  );
}

export function deferShsParticipationCorrectionValidation(transaction: Prisma.TransactionClient) {
  return transaction.$executeRawUnsafe(
    'SET CONSTRAINTS "ShsStudentParticipationCorrection_completion_trigger", "ShsStudentParticipationCorrection_revalidation_trigger", "ShsStudentParticipationCorrection_term_revalidation_trigger", "ShsStudentParticipationCorrection_result_revalidation_trigger" DEFERRED',
  );
}
