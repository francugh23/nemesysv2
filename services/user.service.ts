import { randomInt } from "node:crypto";

import { Prisma } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  countNonArchivedUsers,
  createUser,
  findNonArchivedUsers,
  findUserByEmail,
  findUserByEmployeeNumber,
  findUserFilterOptionValues,
  findUserByUsername,
} from "@/repositories/user.repository";
import {
  CreateUserRoleSchema,
  type CreateUserInput,
  type UserFilterOptions,
  type UserPage,
  type UserTableQuery,
} from "@/schemas";

const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*+-_?";
const PASSWORD_LENGTH = 16;

export class UserCreationError extends Error {}

function randomCharacter(characters: string) {
  return characters[randomInt(characters.length)];
}

function generateTemporaryPassword() {
  const allCharacters = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS;
  const characters = [
    randomCharacter(LOWERCASE),
    randomCharacter(UPPERCASE),
    randomCharacter(DIGITS),
    randomCharacter(SYMBOLS),
    ...Array.from({ length: PASSWORD_LENGTH - 4 }, () =>
      randomCharacter(allCharacters),
    ),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

function rethrowUserIdentityConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new UserCreationError(
      "Employee number, username, or email already exists.",
    );
  }

  throw error;
}

function nullableOrder(direction: "asc" | "desc") {
  return { sort: direction, nulls: "last" } as const;
}

function getUserOrderBy(
  query: UserTableQuery,
): Prisma.UserOrderByWithRelationInput[] {
  const direction = query.direction ?? "asc";

  switch (query.sort) {
    case "employeeNumber":
      return [{ employeeNumber: nullableOrder(direction) }, { id: "asc" }];
    case "username":
      return [{ username: direction }, { id: "asc" }];
    case "name":
      return [
        { lastName: direction },
        { firstName: direction },
        { middleName: nullableOrder(direction) },
        { employeeNumber: nullableOrder(direction) },
        { id: "asc" },
      ];
    case "role":
      return [{ role: direction }, { id: "asc" }];
    case "status":
      return [{ status: direction }, { id: "asc" }];
    case "firstLogin":
      return [{ isFirstLogin: direction }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: direction }, { id: "asc" }];
    default:
      return [
        { lastName: "asc" },
        { firstName: "asc" },
        { middleName: nullableOrder("asc") },
        { employeeNumber: nullableOrder("asc") },
        { id: "asc" },
      ];
  }
}

export async function getUsers(query: UserTableQuery): Promise<UserPage> {
  await requirePermission(Permissions.USERS);

  const filters = {
    search: query.q,
    role: query.role,
    status: query.status,
    firstLogin: query.firstLogin,
  };
  const totalCount = await countNonArchivedUsers(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const users = await findNonArchivedUsers(
    filters,
    {
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    },
    getUserOrderBy(query),
  );

  return {
    items: users,
    totalCount,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getUserFilterOptions(): Promise<UserFilterOptions> {
  await requirePermission(Permissions.USERS);

  const values = await findUserFilterOptionValues();
  const roleOrder = ["SUPER_ADMIN", "REGISTRAR", "PRINCIPAL", "TEACHER"];
  const statusOrder = ["ACTIVE", "INACTIVE"];

  return {
    roles: [...new Set(values.map(({ role }) => role))].sort(
      (first, second) => roleOrder.indexOf(first) - roleOrder.indexOf(second),
    ),
    statuses: [...new Set(values.map(({ status }) => status))].sort(
      (first, second) =>
        statusOrder.indexOf(first) - statusOrder.indexOf(second),
    ),
    firstLoginValues: [
      ...new Set(values.map(({ isFirstLogin }) => isFirstLogin)),
    ].sort((first, second) => Number(second) - Number(first)),
  };
}

export async function createUserService(values: CreateUserInput) {
  const session = await requirePermission(Permissions.USERS);
  const role = CreateUserRoleSchema.safeParse(values.role);

  if (!role.success) {
    throw new UserCreationError(
      "Teacher accounts must be created through Teacher Management.",
    );
  }

  const [existingEmployeeNumber, existingUsername, existingEmail] =
    await Promise.all([
      findUserByEmployeeNumber(values.employeeNumber),
      findUserByUsername(values.username),
      findUserByEmail(values.email),
    ]);

  if (existingEmployeeNumber) {
    throw new UserCreationError("Employee number already exists.");
  }

  if (existingUsername) {
    throw new UserCreationError("Username already exists.");
  }

  if (existingEmail) {
    throw new UserCreationError("Email already exists.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    await prisma.$transaction(async (transaction) => {
      const user = await createUser(
        {
          employeeNumber: values.employeeNumber,
          username: values.username,
          email: values.email,
          passwordHash,
          firstName: values.firstName,
          middleName: values.middleName || null,
          lastName: values.lastName,
          gender: values.gender,
          role: role.data,
          status: "ACTIVE",
          isFirstLogin: true,
        },
        transaction,
      );

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "CREATE",
            module: "User",
            recordId: user.id,
            recordName: `${user.lastName}, ${user.firstName}`,
            description: `Created ${user.role} user account`,
          },
        ],
        transaction,
      );
    });
  } catch (error) {
    rethrowUserIdentityConflict(error);
  }

  return temporaryPassword;
}
