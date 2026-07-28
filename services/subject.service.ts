import { auth } from "@/auth";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { normalizeSubjectIdentity } from "@/lib/subject-identity";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createSubject,
  findSubjectById,
  findSubjectByIdentity,
  findSubjects,
  updateSubject,
} from "@/repositories/subject.repository";
import { CreateSubjectSchema, UpdateSubjectSchema } from "@/schemas";
import { z } from "zod";

export async function getSubjects() {
  return await findSubjects();
}

async function ensureSubjectIdentityAvailable(
  identity: ReturnType<typeof normalizeSubjectIdentity>,
  subjectId?: string,
) {
  const existingSubject = await findSubjectByIdentity(
    identity.code,
    identity.gradeLevel,
    identity.trackStrand,
  );

  if (existingSubject && existingSubject.id !== subjectId) {
    throw new Error("Subject already exists for this grade level and track/strand.");
  }
}

function rethrowSubjectIdentityConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error("Subject already exists for this grade level and track/strand.");
  }

  throw error;
}

export async function createSubjectService(
  values: z.infer<typeof CreateSubjectSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  const identity = normalizeSubjectIdentity(values);

  await ensureSubjectIdentityAvailable(identity);

  try {
    return await prisma.$transaction(async (transaction) => {
      const subject = await createSubject(
        {
          ...identity,
          description: values.description,
          semester: values.semester ?? null,
          createdById: session.user.id,
        },
        transaction,
      );

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "CREATE",
            module: "Subject",
            recordId: subject.id,
            recordName: subject.code,
            description: "Created subject",
          },
        ],
        transaction,
      );

      return subject;
    });
  } catch (error) {
    rethrowSubjectIdentityConflict(error);
  }
}

export async function updateSubjectService(
  id: string,
  values: z.infer<typeof UpdateSubjectSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

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
          semester: values.semester ?? null,
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
