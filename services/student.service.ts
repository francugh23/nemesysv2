import {
  createStudent,
  createStudents,
  findStudentByLRN,
  findStudentsByLRNs,
  findStudents,
  updateStudent,
  softDeleteStudent,
} from "@/repositories/student.repository";
import { createAuditLogs } from "@/repositories/audit.repository";

import { CreateStudentSchema } from "@/schemas";

import { createAuditLog } from "@/services/audit.service";

import prisma from "@/lib/prisma";
import { Permissions, requirePermission } from "@/lib/authorization";

import { z } from "zod";

export async function getStudents() {
  await requirePermission(Permissions.STUDENTS);

  return await findStudents();
}

export async function createStudentService(
  values: z.infer<typeof CreateStudentSchema>,
) {
  const session = await requirePermission(Permissions.STUDENTS);

  const existingStudent = await findStudentByLRN(values.lrn);

  if (existingStudent) {
    throw new Error("LRN already exists.");
  }

  const student = await createStudent({
    ...values,

    status: "UNENROLLED",

    createdBy: {
      connect: {
        id: session.user.id,
      },
    },
  });

  await createAuditLog({
    action: "CREATE",
    module: "Student",
    recordId: student.id,
    recordName: `${student.lastName}, ${student.firstName}`,
    description: "Created student profile",
  });

  return student;
}

export async function importStudentsService(
  values: z.infer<typeof CreateStudentSchema>[],
) {
  const session = await requirePermission(Permissions.STUDENTS);

  const existingStudents = await findStudentsByLRNs(
    values.map((student) => student.lrn),
  );
  const existingLRNs = new Set(existingStudents.map((student) => student.lrn));
  const studentsToCreate = values.filter(
    (student) => !existingLRNs.has(student.lrn),
  );

  if (studentsToCreate.length === 0) {
    return {
      importedCount: 0,
      skippedCount: values.length,
    };
  }

  const result = await prisma.$transaction(async (transaction) => {
    const createdStudents = await createStudents(
      studentsToCreate.map((student) => ({
        ...student,
        status: "UNENROLLED",
        createdById: session.user.id,
      })),
      transaction,
    );

    await createAuditLogs(
      studentsToCreate.map((student) => ({
        userId: session.user.id,
        action: "CREATE",
        module: "Student",
        recordName: `${student.lastName}, ${student.firstName}`,
        description: "Imported student profile",
      })),
      transaction,
    );

    return createdStudents;
  });

  return {
    importedCount: result.count,
    skippedCount: values.length - result.count,
  };
}

export async function updateStudentService(
  id: string,
  values: z.infer<typeof CreateStudentSchema>,
) {
  await requirePermission(Permissions.STUDENTS);

  const student = await updateStudent(id, {
    ...values,
  });

  await createAuditLog({
    action: "UPDATE",
    module: "Student",
    recordId: student.id,
    recordName: `${student.lastName}, ${student.firstName}`,
    description: "Updated student profile",
  });

  return student;
}

export async function deleteStudentService(id: string) {
  await requirePermission(Permissions.STUDENTS);

  const student = await softDeleteStudent(id);

  await createAuditLog({
    action: "DELETE",
    module: "Student",
    recordId: student.id,
    recordName: `${student.lastName}, ${student.firstName}`,
    description: "Soft deleted student profile",
  });

  return student;
}
