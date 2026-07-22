import { auth } from "@/auth";

import {
  createStudent,
  findStudentByLRN,
  findStudents,
  updateStudent,
  softDeleteStudent,
} from "@/repositories/student.repository";

import { CreateStudentSchema } from "@/schemas";

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

  return await createStudent({
    ...values,

    status: "UNENROLLED",

    createdBy: {
      connect: {
        id: session.user.id,
      },
    },
  });
}

export async function updateStudentService(
  id: string,
  values: z.infer<typeof CreateStudentSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  return await updateStudent(id, {
    ...values,
  });
}

export async function deleteStudentService(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  return await softDeleteStudent(id);
}