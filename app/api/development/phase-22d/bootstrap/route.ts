import { NextResponse } from "next/server";

import { AuthorizationError, requireRole } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAcademicTermService } from "@/services/academic-term.service";
import {
  activateAcademicYearService,
  createAcademicYearService,
} from "@/services/academic-year.service";
import { getOperationalDashboard } from "@/services/dashboard.service";
import { createSectionService } from "@/services/section.service";
import { createShsElectiveEnrollmentPolicyService } from "@/services/shs-elective-enrollment-policy.service";
import { createSubjectOfferingService } from "@/services/subject-offering.service";

const confirmation = "PHASE_22D_REBUILD_SY_2026_2027";
const jhsPrefixes = ["FIL", "ENG", "MATH", "SCI", "AP", "MAPEH", "TLE", "GMRC"];
const shs = [
  ["SSHS-G11-CORE-01", "CORE", undefined, [1, 2, 3]],
  ["SSHS-G11-CORE-02", "CORE", undefined, [1, 2, 3]],
  ["SSHS-G11-CORE-03", "CORE", undefined, [1, 2, 3]],
  ["SSHS-G11-CORE-04", "CORE", undefined, [1, 2, 3]],
  ["SSHS-G11-CORE-05", "CORE", undefined, [1, 2, 3]],
  ["SSHS-G11-ACA-ASSH-01", "ACADEMIC_ELECTIVE", "ACA-ASSH", [1]],
  ["SSHS-G11-ACA-ASSH-02", "ACADEMIC_ELECTIVE", "ACA-ASSH", [2]],
  ["SSHS-G11-TP-CADT-01", "TECHPRO_ELECTIVE", "TP-CADT", [1, 2, 3]],
] as const;

function developmentOnly() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Phase 22D bootstrap is available only in development.");
  }
}

async function assertCleanBaseline() {
  const [users, teachers, students, sections, subjects, years, terms, offerings, offeringTerms, contexts, clusters, policies, finalizations, enrollments, participation, audits] = await Promise.all([
    prisma.user.count(), prisma.teacher.count(), prisma.student.count(), prisma.section.count(), prisma.subject.count({ where: { deletedAt: null } }), prisma.academicYear.count(), prisma.academicTerm.count(), prisma.subjectOffering.count({ where: { deletedAt: null } }), prisma.subjectOfferingTerm.count(), prisma.subjectOfferingShsContext.count(), prisma.shsCurriculumCluster.count({ where: { deletedAt: null } }), prisma.shsElectiveEnrollmentPolicy.count(), prisma.curriculumFinalization.count(), prisma.enrollment.count(), prisma.studentSubjectEnrollment.count(), prisma.auditLog.count(),
  ]);
  if (users !== 1 || teachers || students || sections || subjects !== 53 || years || terms || offerings || offeringTerms || contexts || clusters !== 8 || policies || finalizations || enrollments || participation || audits) {
    throw new Error("Database does not match the required Phase 22C clean baseline.");
  }
}

export async function POST(request: Request) {
  try {
    developmentOnly();
    await requireRole("SUPER_ADMIN");
    const body = await request.json() as { confirmation?: string };
    if (body.confirmation !== confirmation) {
      return NextResponse.json({ message: "Typed confirmation is required." }, { status: 400 });
    }

    await assertCleanBaseline();
    const academicYear = await createAcademicYearService({ startDate: "2026-06-08", endDate: "2027-04-08" });
    for (const term of [
      { name: "Term 1", position: 1, startDate: "2026-06-08", endDate: "2026-09-15" },
      { name: "Term 2", position: 2, startDate: "2026-09-16", endDate: "2026-12-18" },
      { name: "Term 3", position: 3, startDate: "2027-01-04", endDate: "2027-04-08" },
    ]) await createAcademicTermService(academicYear.id, term);

    const draftDashboard = await getOperationalDashboard();
    if (draftDashboard.state !== "NO_ACTIVE_ACADEMIC_YEAR") throw new Error("DRAFT dashboard unexpectedly resolved an active Academic Year.");

    await activateAcademicYearService(academicYear.id);
    for (const gradeLevel of ["7", "8", "9", "10", "11"] as const) await createSectionService({ gradeLevel, sectionName: "A" });

    const [subjects, terms, clusters] = await Promise.all([
      prisma.subject.findMany({ where: { deletedAt: null }, select: { id: true, code: true } }),
      prisma.academicTerm.findMany({ where: { academicYearId: academicYear.id }, select: { id: true, position: true } }),
      prisma.shsCurriculumCluster.findMany({ where: { deletedAt: null, isSchoolFacing: true }, select: { id: true, code: true } }),
    ]);
    const subjectIds = new Map(subjects.map((subject) => [subject.code, subject.id]));
    const termIds = new Map(terms.map((term) => [term.position, term.id]));
    const clusterIds = new Map(clusters.map((cluster) => [cluster.code, cluster.id]));
    const allTermIds = [1, 2, 3].map((position) => termIds.get(position)!);

    for (const gradeLevel of ["7", "8", "9", "10"] as const) for (const prefix of jhsPrefixes) {
      const subjectId = subjectIds.get(`${prefix}${gradeLevel}`);
      if (!subjectId) throw new Error(`Required Subject ${prefix}${gradeLevel} is missing.`);
      await createSubjectOfferingService({ subjectId, academicYearId: academicYear.id, gradeLevel, academicTermIds: allTermIds });
    }
    for (const [code, classification, clusterCode, positions] of shs) {
      const subjectId = subjectIds.get(code);
      if (!subjectId) throw new Error(`Required Subject ${code} is missing.`);
      await createSubjectOfferingService({ subjectId, academicYearId: academicYear.id, gradeLevel: "11", academicTermIds: positions.map((position) => termIds.get(position)!), shsContext: { classification, curriculumStatus: "PROVISIONAL_DEPED", clusterId: clusterCode ? clusterIds.get(clusterCode) : undefined, sourceReference: `DepEd Strengthened SHS Curriculum: https://www.deped.gov.ph/strengthened-shs-program/` } });
    }
    for (const gradeLevel of ["11", "12"] as const) for (const position of [1, 2, 3]) {
      const zero = gradeLevel === "12";
      await createShsElectiveEnrollmentPolicyService({ academicYearId: academicYear.id, academicTermId: termIds.get(position)!, gradeLevel, minimumElectives: zero ? 0 : 1, maximumElectives: zero ? 0 : 1 });
    }
    return NextResponse.json({ academicYearId: academicYear.id, pendingSchoolApproval: 8, confirmationRequiredForApproval: "A separate controlled continuation with legitimate school approval references is required." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
