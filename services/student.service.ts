import { auth } from "@/auth";

import {
  createStudent,
  findStudentByLRN,
  findStudents,
  updateStudent,
  softDeleteStudent,
} from "@/repositories/student.repository";

import { CreateStudentSchema } from "@/schemas";

import { createAuditLog } from "@/services/audit.service";

import { z } from "zod";

export async function getStudents() {
  return await findStudents();
}

export async function createStudentService(
  values: z.infer<typeof CreateStudentSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

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

export async function updateStudentService(
  id: string,
  values: z.infer<typeof CreateStudentSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

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
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

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