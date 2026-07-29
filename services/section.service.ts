import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createSection,
  findActiveSectionByIdentity,
  findActiveSections,
} from "@/repositories/section.repository";
import {
  findActiveTeacherForSection,
  findActiveTeachersForSection,
} from "@/repositories/teacher.repository";
import { CreateSectionSchema, type SectionListItem } from "@/schemas";
import { z } from "zod";

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }

  return session;
}

export async function getSections(): Promise<SectionListItem[]> {
  await requireSuperAdmin();

  const sections = await findActiveSections();

  return sections.map((section) => ({
    id: section.id,
    gradeLevel: section.gradeLevel,
    trackStrand: section.trackStrand,
    sectionName: section.sectionName,
    adviserFirstName: section.adviser?.user.firstName ?? null,
    adviserMiddleName: section.adviser?.user.middleName ?? null,
    adviserLastName: section.adviser?.user.lastName ?? null,
    room: section.room,
    shift: section.shift,
  }));
}

export async function getSectionFormOptions() {
  await requireSuperAdmin();

  const teachers = await findActiveTeachersForSection();

  return {
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      employeeNumber: teacher.user.employeeNumber,
      firstName: teacher.user.firstName,
      middleName: teacher.user.middleName,
      lastName: teacher.user.lastName,
    })),
  };
}

function rethrowSectionIdentityConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error(
      "An active section already exists for this grade level, track/strand, and section name.",
    );
  }

  throw error;
}

export async function createSectionService(
  values: z.infer<typeof CreateSectionSchema>,
) {
  const session = await requireSuperAdmin();
  const identity = {
    gradeLevel: values.gradeLevel,
    trackStrand: values.trackStrand?.trim().toUpperCase() || null,
    sectionName: values.sectionName.trim(),
  };
  const adviserId = values.adviserId || null;

  try {
    return await prisma.$transaction(async (transaction) => {
      if (adviserId) {
        const adviser = await findActiveTeacherForSection(adviserId, transaction);

        if (!adviser) {
          throw new Error("Adviser not found or inactive.");
        }
      }

      const duplicate = await findActiveSectionByIdentity(
        identity.gradeLevel,
        identity.trackStrand,
        identity.sectionName,
        transaction,
      );

      if (duplicate) {
        throw new Error(
          "An active section already exists for this grade level, track/strand, and section name.",
        );
      }

      const section = await createSection(
        {
          ...identity,
          adviserId,
          room: values.room?.trim() || null,
          shift: values.shift ?? null,
          createdById: session.user.id,
        },
        transaction,
      );

      const sectionIdentity = `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`;

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "CREATE",
            module: "Section",
            recordId: section.id,
            recordName: sectionIdentity,
            description: "Created section",
          },
        ],
        transaction,
      );

      return section;
    });
  } catch (error) {
    rethrowSectionIdentityConflict(error);
  }
}
