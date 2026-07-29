import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  archiveSection,
  createSection,
  findActiveSectionById,
  findActiveSectionByIdentity,
  findActiveSections,
  hasActiveSectionEnrollments,
  hasActiveSectionSubjectAssignments,
  updateSection,
} from "@/repositories/section.repository";
import {
  findActiveTeacherForSection,
  findActiveTeachersForSection,
} from "@/repositories/teacher.repository";
import {
  CreateSectionSchema,
  type SectionListItem,
  UpdateSectionSchema,
} from "@/schemas";
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
    adviserId: section.adviserId,
    adviserFirstName: section.adviser?.user.firstName ?? null,
    adviserMiddleName: section.adviser?.user.middleName ?? null,
    adviserLastName: section.adviser?.user.lastName ?? null,
    room: section.room,
    shift: section.shift,
  }));
}

function normalizeSectionValues(
  values: z.infer<typeof CreateSectionSchema>,
) {
  return {
    identity: {
      gradeLevel: values.gradeLevel,
      trackStrand: values.trackStrand?.trim().toUpperCase() || null,
      sectionName: values.sectionName.trim(),
    },
    adviserId: values.adviserId || null,
    room: values.room?.trim() || null,
    shift: values.shift ?? null,
  };
}

function getSectionIdentity(section: {
  gradeLevel: string;
  trackStrand: string | null;
  sectionName: string;
}) {
  return `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`;
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
  const { identity, adviserId, room, shift } = normalizeSectionValues(values);

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
        undefined,
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
          room,
          shift,
          createdById: session.user.id,
        },
        transaction,
      );

      const sectionIdentity = getSectionIdentity(section);

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

export async function updateSectionService(
  id: string,
  values: z.infer<typeof UpdateSectionSchema>,
) {
  const session = await requireSuperAdmin();
  const { identity, adviserId, room, shift } = normalizeSectionValues(values);

  try {
    return await prisma.$transaction(async (transaction) => {
      const section = await findActiveSectionById(id, transaction);

      if (!section) {
        throw new Error("Section not found.");
      }

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
        section.id,
        transaction,
      );

      if (duplicate) {
        throw new Error(
          "An active section already exists for this grade level, track/strand, and section name.",
        );
      }

      const updatedSection = await updateSection(
        section.id,
        {
          ...identity,
          adviserId,
          room,
          shift,
        },
        transaction,
      );

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "UPDATE",
            module: "Section",
            recordId: updatedSection.id,
            recordName: getSectionIdentity(updatedSection),
            description: "Updated section",
          },
        ],
        transaction,
      );

      return updatedSection;
    });
  } catch (error) {
    rethrowSectionIdentityConflict(error);
  }
}

export async function archiveSectionService(id: string) {
  const session = await requireSuperAdmin();

  return prisma.$transaction(async (transaction) => {
    const section = await findActiveSectionById(id, transaction);

    if (!section) {
      throw new Error("Section not found.");
    }

    const [hasActiveAssignments, hasActiveEnrollments] = await Promise.all([
      hasActiveSectionSubjectAssignments(section.id, transaction),
      hasActiveSectionEnrollments(section.id, transaction),
    ]);

    if (hasActiveAssignments) {
      throw new Error(
        "Section cannot be archived while it has active subject assignments.",
      );
    }

    if (hasActiveEnrollments) {
      throw new Error(
        "Section cannot be archived while it has active enrolments.",
      );
    }

    const archivedSection = await archiveSection(section.id, transaction);

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "ARCHIVE",
          module: "Section",
          recordId: archivedSection.id,
          recordName: getSectionIdentity(archivedSection),
          description: "Archived section",
        },
      ],
      transaction,
    );

    return archivedSection;
  });
}
