import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { createShsElectiveEnrollmentPolicyInTransaction } from "@/services/shs-elective-enrollment-policy.service";
import { createSubjectInTransaction } from "@/services/subject.service";
import {
  createSubjectOfferingInTransaction,
  promoteShsSubjectOfferingInTransaction,
} from "@/services/subject-offering.service";

const DEPED_SSHS_PROGRAM_URL = "https://www.deped.gov.ph/strengthened-shs-program/";

const grade12Pilot = [
  {
    code: "SSHS-G12-ACA-ADV-MATH",
    description: "Advanced Mathematics",
    termPosition: 1,
    classification: "ACADEMIC_ELECTIVE" as const,
    clusterCode: "ACA-STEM",
    sourceReference: `DepEd SSHS Grade 12 Curriculum Guide, Advanced Mathematics: https://www.deped.gov.ph/wp-content/uploads/1-Updated-as-of-05.29.26_Advanced-Mathematics.pdf; ${DEPED_SSHS_PROGRAM_URL}`,
  },
  {
    code: "SSHS-G12-TP-CADT-VGD",
    description: "Visual Graphic Design",
    termPosition: 1,
    classification: "TECHPRO_ELECTIVE" as const,
    clusterCode: "TP-CADT",
    sourceReference: `DepEd SSHS Grade 12 Curriculum Guide, Visual Graphic Design: https://www.deped.gov.ph/wp-content/uploads/G12-Visual-Graphic-Design.pdf; ${DEPED_SSHS_PROGRAM_URL}`,
  },
  {
    code: "SSHS-G12-ACA-CPP",
    description: "Creative Production and Presentation",
    termPosition: 2,
    classification: "ACADEMIC_ELECTIVE" as const,
    clusterCode: "ACA-ASSH",
    sourceReference: `DepEd SSHS Grade 12 Curriculum Guide, Creative Production and Presentation: https://www.deped.gov.ph/wp-content/uploads/CREATIVE-PRODUCTION-AND-PRESENTATION.pdf; ${DEPED_SSHS_PROGRAM_URL}`,
  },
  {
    code: "SSHS-G12-TP-HT-FBO",
    description: "Food and Beverage Operation",
    termPosition: 2,
    classification: "TECHPRO_ELECTIVE" as const,
    clusterCode: "TP-HT",
    sourceReference: `DepEd SSHS Grade 12 Curriculum Guide, Food and Beverage Operation: https://www.deped.gov.ph/wp-content/uploads/G12-Food-and-Beverage-Operation.pdf; ${DEPED_SSHS_PROGRAM_URL}`,
  },
] as const;

export class Phase22dC3Grade12PilotError extends Error {}

async function assertPilotPreconditions(
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const actor = await transaction.user.findFirst({
    where: {
      id: actorId,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      deletedAt: null,
      isFirstLogin: false,
    },
    select: { id: true },
  });
  const academicYear = await transaction.academicYear.findFirst({
    where: { label: "2026-2027", status: "ACTIVE" },
    select: {
      id: true,
      terms: {
        select: { id: true, position: true },
        orderBy: { position: "asc" },
      },
    },
  });
  const grade12SubjectCount = await transaction.subject.count({
    where: { gradeLevel: "12", deletedAt: null },
  });
  const grade12OfferingCount = await transaction.subjectOffering.count({
    where: { gradeLevel: "12", deletedAt: null },
  });
  const grade12PolicyCount = await transaction.shsElectiveEnrollmentPolicy.count({
    where: { gradeLevel: "12" },
  });

  if (!actor) throw new Phase22dC3Grade12PilotError("An active non-first-login Super Admin actor is required.");
  if (!academicYear || academicYear.terms.length !== 3) {
    throw new Phase22dC3Grade12PilotError("Active 2026-2027 with three configured Terms is required.");
  }
  if (grade12SubjectCount || grade12OfferingCount || grade12PolicyCount) {
    throw new Phase22dC3Grade12PilotError("Grade 12 pilot data already exists; refusing partial or duplicate population.");
  }

  const clusters = await transaction.shsCurriculumCluster.findMany({
    where: { code: { in: grade12Pilot.map(({ clusterCode }) => clusterCode) }, deletedAt: null, isSchoolFacing: true },
    select: { id: true, code: true, track: true },
  });
  if (clusters.length !== 4) {
    throw new Phase22dC3Grade12PilotError("All four verified school-facing pilot clusters are required.");
  }

  return { academicYear, clusters: new Map(clusters.map((cluster) => [cluster.code, cluster])) };
}

export async function populatePhase22dC3Grade12Pilot(actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const { academicYear, clusters } = await assertPilotPreconditions(actorId, transaction);
    const terms = new Map(academicYear.terms.map((term) => [term.position, term.id]));

    const subjects = new Map<string, { id: string }>();
    for (const pilot of grade12Pilot) {
      subjects.set(
        pilot.code,
        await createSubjectInTransaction(
          { code: pilot.code, description: pilot.description, gradeLevel: "12" },
          actorId,
          transaction,
        ),
      );
    }

    const offerings = [];
    for (const pilot of grade12Pilot) {
      const cluster = clusters.get(pilot.clusterCode);
      const academicTermId = terms.get(pilot.termPosition);
      if (!cluster || !academicTermId) throw new Phase22dC3Grade12PilotError("Verified pilot cluster or Term is missing.");
      offerings.push(
        await createSubjectOfferingInTransaction(
          {
            subjectId: subjects.get(pilot.code)!.id,
            academicYearId: academicYear.id,
            gradeLevel: "12",
            academicTermIds: [academicTermId],
            shsContext: {
              classification: pilot.classification,
              curriculumStatus: "PROVISIONAL_DEPED",
              clusterId: cluster.id,
              sourceReference: pilot.sourceReference,
            },
          },
          actorId,
          transaction,
        ),
      );
    }

    if (offerings.some((offering) => offering.shsContext?.curriculumStatus !== "PROVISIONAL_DEPED")) {
      throw new Phase22dC3Grade12PilotError("Every Grade 12 pilot Offering must begin as PROVISIONAL_DEPED.");
    }
    for (const offering of offerings) {
      await promoteShsSubjectOfferingInTransaction(
        {
          subjectOfferingId: offering.id,
          approvalReference: `DEMO-BOT-AY2026-2027-${offering.subjectCode}`,
        },
        actorId,
        transaction,
      );
    }

    const approvedOfferingCount = await transaction.subjectOffering.count({
      where: {
        academicYearId: academicYear.id,
        gradeLevel: "12",
        deletedAt: null,
        shsContext: { curriculumStatus: "SCHOOL_APPROVED" },
      },
    });
    const term3ElectiveCount = await transaction.subjectOffering.count({
      where: {
        academicYearId: academicYear.id,
        gradeLevel: "12",
        deletedAt: null,
        terms: { some: { academicTerm: { position: 3 } } },
        shsContext: { classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] } },
      },
    });
    if (approvedOfferingCount !== 4 || term3ElectiveCount !== 0) {
      throw new Phase22dC3Grade12PilotError("Approved Grade 12 pilot matrix is incomplete or has Term 3 electives.");
    }

    for (const [position, minimumElectives, maximumElectives] of [[1, 1, 1], [2, 1, 1], [3, 0, 0]] as const) {
      await createShsElectiveEnrollmentPolicyInTransaction(
        {
          academicYearId: academicYear.id,
          academicTermId: terms.get(position)!,
          gradeLevel: "12",
          minimumElectives,
          maximumElectives,
        },
        actorId,
        transaction,
      );
    }

    return { subjectCount: subjects.size, offeringCount: offerings.length, policyCount: 3 };
  });
}
