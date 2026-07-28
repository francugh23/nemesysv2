import { auth } from "@/auth";
import { hashPassword } from "@/lib";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createTeacher,
  findTeacherById,
  findTeachers,
  softDeleteTeacher,
  updateTeacher,
} from "@/repositories/teacher.repository";
import {
  createUser,
  findUserByEmail,
  findUserByEmployeeNumber,
  findUserByUsername,
  updateUser,
} from "@/repositories/user.repository";
import { CreateTeacherSchema, UpdateTeacherSchema } from "@/schemas";
import { z } from "zod";

export async function getTeachers() {
  return await findTeachers();
}

export async function createTeacherService(
  values: z.infer<typeof CreateTeacherSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  const [existingEmployeeNumber, existingUsername, existingEmail] =
    await Promise.all([
      findUserByEmployeeNumber(values.employeeNumber),
      findUserByUsername(values.username),
      findUserByEmail(values.email),
    ]);

  if (existingEmployeeNumber) {
    throw new Error("Employee number already exists.");
  }

  if (existingUsername) {
    throw new Error("Username already exists.");
  }

  if (existingEmail) {
    throw new Error("Email already exists.");
  }

  const passwordHash = await hashPassword(values.temporaryPassword);

  return prisma.$transaction(async (transaction) => {
    const user = await createUser(
      {
        employeeNumber: values.employeeNumber,
        username: values.username,
        email: values.email,
        passwordHash,
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        gender: values.gender,
        role: "TEACHER",
        isFirstLogin: true,
      },
      transaction,
    );

    const teacher = await createTeacher(
      {
        userId: user.id,
        degree: values.degree,
        major: values.major,
        isAdviser: false,
      },
      transaction,
    );

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "CREATE",
          module: "Teacher",
          recordId: teacher.id,
          recordName: `${user.lastName}, ${user.firstName}`,
          description: "Created teacher profile",
        },
      ],
      transaction,
    );

    return teacher;
  });
}

export async function updateTeacherService(
  id: string,
  values: z.infer<typeof UpdateTeacherSchema>,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  const teacher = await findTeacherById(id);

  if (!teacher) {
    throw new Error("Teacher not found.");
  }

  const [existingEmployeeNumber, existingUsername, existingEmail] =
    await Promise.all([
      findUserByEmployeeNumber(values.employeeNumber),
      findUserByUsername(values.username),
      findUserByEmail(values.email),
    ]);

  if (existingEmployeeNumber && existingEmployeeNumber.id !== teacher.userId) {
    throw new Error("Employee number already exists.");
  }

  if (existingUsername && existingUsername.id !== teacher.userId) {
    throw new Error("Username already exists.");
  }

  if (existingEmail && existingEmail.id !== teacher.userId) {
    throw new Error("Email already exists.");
  }

  return prisma.$transaction(async (transaction) => {
    const user = await updateUser(
      teacher.userId,
      {
        employeeNumber: values.employeeNumber,
        username: values.username,
        email: values.email,
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        gender: values.gender,
      },
      transaction,
    );

    const updatedTeacher = await updateTeacher(
      teacher.id,
      {
        degree: values.degree,
        major: values.major,
      },
      transaction,
    );

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "UPDATE",
          module: "Teacher",
          recordId: updatedTeacher.id,
          recordName: `${user.lastName}, ${user.firstName}`,
          description: "Updated teacher profile",
        },
      ],
      transaction,
    );

    return updatedTeacher;
  });
}

export async function deactivateTeacherService(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  const teacher = await findTeacherById(id);

  if (!teacher) {
    throw new Error("Teacher not found.");
  }

  return prisma.$transaction(async (transaction) => {
    const deactivatedTeacher = await softDeleteTeacher(teacher.id, transaction);
    const user = await updateUser(
      teacher.userId,
      {
        status: "INACTIVE",
      },
      transaction,
    );

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "DEACTIVATE",
          module: "Teacher",
          recordId: deactivatedTeacher.id,
          recordName: `${user.lastName}, ${user.firstName}`,
          description: "Deactivated teacher account",
        },
      ],
      transaction,
    );

    return deactivatedTeacher;
  });
}
