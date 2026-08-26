import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import {
  getSubjectIdentityKey,
  normalizeSubjectIdentity,
} from "@/lib/subject-identity";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createSubject,
  countNonArchivedSubjects,
  countSubjectGrades,
  findActiveSubjectById,
  findSubjectById,
  findSubjectByIdentity,
  findNonArchivedSubjects,
  findNonArchivedSubjectsByGrade,
  findSubjectFilterOptionValues,
  findActiveSubjectsByIdentities,
  hasActiveSubjectAssignments,
  archiveSubject,
  updateSubject,
} from "@/repositories/subject.repository";
import {
  CreateSubjectSchema,
  type SubjectTableQuery,
  UpdateSubjectSchema,
} from "@/schemas";
import type { SubjectFilterOptions, SubjectPage } from "@/types/subject";
import { generateImportTemplate } from "@/services/import-template.service";
import { subjectImportTemplateDefinition } from "@/lib/import/definitions/subject-import-template.definition";
import type { ImportTemplateFile } from "@/types/import-template";
import { z } from "zod";

export async function getSubjectImportTemplate(): Promise<ImportTemplateFile> {
  await requirePermission(Permissions.SUBJECTS);

  return generateImportTemplate(subjectImportTemplateDefinition);
}

function getSubjectOrderBy(
  query: SubjectTableQuery,
): Prisma.SubjectOrderByWithRelationInput[] {
  const direction = query.direction ?? "asc";

  switch (query.sort) {
    case "code":
      return [{ code: direction }, { id: "asc" }];
    case "description":
      return [{ description: direction }, { id: "asc" }];
    default:
      return [{ id: "asc" }];
  }
}

export async function getSubjects(
  query: SubjectTableQuery,
): Promise<SubjectPage> {
  await requirePermission(Permissions.SUBJECTS);

  const filters = {
    search: query.q,
    schoolLevel: query.schoolLevel,
    grade: query.grade,
  };
  const totalCount = await countNonArchivedSubjects(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const pagination = {
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  };
  const subjects =
    !query.sort || query.sort === "gradeLevel"
      ? await findNonArchivedSubjectsByGrade(
          filters,
          pagination,
          query.sort === "gradeLevel" ? query.direction ?? "asc" : "asc",
        )
      : await findNonArchivedSubjects(
          filters,
          pagination,
          getSubjectOrderBy(query),
        );

  return {
    items: subjects.map(({ _count, ...subject }) => ({
      ...subject,
      activeCurriculumCount: _count.offerings,
    })),
    totalCount,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getSubjectFilterOptions(): Promise<SubjectFilterOptions> {
  await requirePermission(Permissions.SUBJECTS);

  const gradeLevels = await findSubjectFilterOptionValues();

  return {
    gradeLevels: gradeLevels
      .map((value) => value.gradeLevel)
      .sort((first, second) => Number(first) - Number(second)),
  };
}

async function ensureSubjectIdentityAvailable(
  identity: ReturnType<typeof normalizeSubjectIdentity>,
  subjectId?: string,
  transaction?: Prisma.TransactionClient,
) {
  const existingSubject = await findSubjectByIdentity(
    identity.code,
    identity.gradeLevel,
    transaction,
  );

  if (existingSubject && existingSubject.id !== subjectId) {
    throw new Error("Subject already exists for this grade level.");
  }
}

function rethrowSubjectIdentityConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error("Subject already exists for this grade level.");
  }

  throw error;
}

export async function createSubjectInTransaction(
  values: z.infer<typeof CreateSubjectSchema>,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const identity = normalizeSubjectIdentity(values);
  await ensureSubjectIdentityAvailable(identity, undefined, transaction);
  const subject = await createSubject(
    { ...identity, description: values.description, createdById: actorId },
    transaction,
  );
  await createAuditLogs(
    [{
      userId: actorId,
      action: "CREATE",
      module: "Subject",
      recordId: subject.id,
      recordName: subject.code,
      description: "Created subject",
    }],
    transaction,
  );
  return subject;
}

export async function createSubjectService(
  values: z.infer<typeof CreateSubjectSchema>,
) {
  const session = await requirePermission(Permissions.SUBJECTS);

  try {
    return await prisma.$transaction((transaction) =>
      createSubjectInTransaction(values, session.user.id, transaction),
    );
  } catch (error) {
    rethrowSubjectIdentityConflict(error);
  }
}

export async function updateSubjectService(
  id: string,
  values: z.infer<typeof UpdateSubjectSchema>,
) {
  const session = await requirePermission(Permissions.SUBJECTS);

  const subject = await findSubjectById(id);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  const identity = normalizeSubjectIdentity(values);

  await ensureSubjectIdentityAvailable(identity, subject.id);

  try {
    return await prisma.$transaction(async (transaction) => {
      const updatedSubject = await updateSubject(
        subject.id,
        {
          ...identity,
          description: values.description,
        },
        transaction,
      );

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "UPDATE",
            module: "Subject",
            recordId: updatedSubject.id,
            recordName: updatedSubject.code,
            description: "Updated subject",
          },
        ],
        transaction,
      );

      return updatedSubject;
    });
  } catch (error) {
    rethrowSubjectIdentityConflict(error);
  }
}

export async function importSubjectsService(
  values: z.infer<typeof CreateSubjectSchema>[],
) {
  const session = await requirePermission(Permissions.SUBJECTS);

  const identities = values.map((subject) => normalizeSubjectIdentity(subject));
  const identityKeys = new Set<string>();

  for (const identity of identities) {
    const identityKey = getSubjectIdentityKey(identity);

    if (identityKeys.has(identityKey)) {
      throw new Error("Duplicate Subject identity in import data.");
    }

    identityKeys.add(identityKey);
  }

  const existingSubjects = await findActiveSubjectsByIdentities(identities);
  const existingIdentityKeys = new Set(
    existingSubjects.map((subject) =>
      getSubjectIdentityKey(normalizeSubjectIdentity(subject)),
    ),
  );
  const subjectsToCreate = values.filter(
    (subject) =>
      !existingIdentityKeys.has(
        getSubjectIdentityKey(normalizeSubjectIdentity(subject)),
      ),
  );

  if (subjectsToCreate.length === 0) {
    return {
      importedCount: 0,
      skippedCount: values.length,
    };
  }

  try {
    const createdSubjects = await prisma.$transaction(async (transaction) => {
      const subjects = [];

      for (const subject of subjectsToCreate) {
        const identity = normalizeSubjectIdentity(subject);
        const createdSubject = await createSubject(
          {
            ...identity,
            description: subject.description,
            createdById: session.user.id,
          },
          transaction,
        );

        subjects.push(createdSubject);
      }

      await createAuditLogs(
        subjects.map((subject) => ({
          userId: session.user.id,
          action: "CREATE",
          module: "Subject",
          recordId: subject.id,
          recordName: subject.code,
          description: "Imported subject",
        })),
        transaction,
      );

      return subjects;
    });

    return {
      importedCount: createdSubjects.length,
      skippedCount: values.length - createdSubjects.length,
    };
  } catch (error) {
    rethrowSubjectIdentityConflict(error);
  }
}

export async function archiveSubjectService(id: string) {
  const session = await requirePermission(Permissions.SUBJECTS);

  return prisma.$transaction(async (transaction) => {
    const subject = await findActiveSubjectById(id, transaction);

    if (!subject) {
      throw new Error("Subject not found.");
    }

    const [hasActiveAssignments, gradeCount] = await Promise.all([
      hasActiveSubjectAssignments(subject.id, transaction),
      countSubjectGrades(subject.id, transaction),
    ]);

    if (hasActiveAssignments) {
      throw new Error("Subject cannot be archived while it has active assignments.");
    }

    const archivedSubject = await archiveSubject(subject.id, transaction);

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "ARCHIVE",
          module: "Subject",
          recordId: archivedSubject.id,
          recordName: archivedSubject.code,
          description: "Archived subject",
          metadata: {
            gradeCount,
          },
        },
      ],
      transaction,
    );

    return archivedSubject;
  });
}
