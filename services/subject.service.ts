import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createSubject,
  findSubjectByIdentity,
  findSubjects,
} from "@/repositories/subject.repository";
import { CreateSubjectSchema } from "@/schemas";
import { z } from "zod";

export async function getSubjects() {
  return await findSubjects();
}

export async function createSubjectService(
  values: z.infer<typeof CreateSubjectSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  const trackStrand = values.trackStrand || null;

  if (trackStrand) {
    const existingSubject = await findSubjectByIdentity(
      values.code,
      values.gradeLevel,
      trackStrand,
    );

    if (existingSubject) {
      throw new Error("Subject already exists for this grade level and track/strand.");
    }
  }

  return prisma.$transaction(async (transaction) => {
    const subject = await createSubject(
      {
        code: values.code,
        description: values.description,
        gradeLevel: values.gradeLevel,
        trackStrand,
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
}
