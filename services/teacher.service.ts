import { hashPassword } from "@/lib";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  countNonArchivedTeachers,
  createTeacher,
  findNonArchivedTeachers,
  findTeacherById,
  findTeacherFilterOptionValues,
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
import {
  CreateTeacherSchema,
  type TeacherFilterOptions,
  type TeacherPage,
  type TeacherTableQuery,
  UpdateTeacherSchema,
} from "@/schemas";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";

function getTeacherOrderBy(
  query: TeacherTableQuery,
): Prisma.TeacherOrderByWithRelationInput[] {
  const direction = query.direction ?? "asc";

  switch (query.sort) {
    case "employeeNumber":
      return [{ user: { employeeNumber: direction } }, { id: "asc" }];
    case "lastName":
      return [{ user: { lastName: direction } }, { id: "asc" }];
    case "firstName":
      return [{ user: { firstName: direction } }, { id: "asc" }];
    case "middleName":
      return [{ user: { middleName: direction } }, { id: "asc" }];
    case "gender":
      return [{ user: { gender: direction } }, { id: "asc" }];
    case "degree":
      return [{ degree: direction }, { id: "asc" }];
    case "major":
      return [{ major: direction }, { id: "asc" }];
    case "isAdviser":
      return [{ isAdviser: direction }, { id: "asc" }];
    case "status":
      return [{ user: { status: direction } }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: direction }, { id: "asc" }];
    default:
      return [
        { user: { lastName: "asc" } },
        { user: { firstName: "asc" } },
        { user: { middleName: "asc" } },
        { user: { employeeNumber: "asc" } },
        { id: "asc" },
      ];
  }
}

export async function getTeachers(
  query: TeacherTableQuery,
): Promise<TeacherPage> {
  await requirePermission(Permissions.TEACHERS);

  const filters = {
    search: query.q,
    status: query.status,
    gender: query.gender,
  };
  const totalCount = await countNonArchivedTeachers(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const teachers = await findNonArchivedTeachers(
    filters,
    {
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    },
    getTeacherOrderBy(query),
  );

  return {
    items: teachers,
    totalCount,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getTeacherFilterOptions(): Promise<TeacherFilterOptions> {
  await requirePermission(Permissions.TEACHERS);

  const values = await findTeacherFilterOptionValues();
  const statuses = [...new Set(values.map(({ user }) => user.status))];
  const genders = [...new Set(values.map(({ user }) => user.gender))];

  return {
    statuses: statuses.sort(
      (first, second) =>
        ["ACTIVE", "INACTIVE"].indexOf(first) -
        ["ACTIVE", "INACTIVE"].indexOf(second),
    ),
    genders: genders.sort(
      (first, second) =>
        ["MALE", "FEMALE"].indexOf(first) -
        ["MALE", "FEMALE"].indexOf(second),
    ),
  };
}

export async function createTeacherService(
  values: z.infer<typeof CreateTeacherSchema>,
) {
  const session = await requirePermission(Permissions.TEACHERS);

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
  const session = await requirePermission(Permissions.TEACHERS);

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
  const session = await requirePermission(Permissions.TEACHERS);

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
