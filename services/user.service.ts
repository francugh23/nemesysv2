import { Prisma } from "@/app/generated/prisma/client";
import { generateTemporaryPassword, hashPassword } from "@/lib";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  countNonArchivedUsers,
  countActiveSuperAdmins,
  createUser,
  findNonArchivedUserForUpdate,
  findNonArchivedUsers,
  findUserByEmail,
  findUserByEmployeeNumber,
  findUserFilterOptionValues,
  findUserByUsername,
  findUsersByIdentity,
  resetUserPassword,
  updateUser,
} from "@/repositories/user.repository";
import {
  CreateUserRoleSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserFilterOptions,
  type UserPage,
  type UserTableQuery,
} from "@/schemas";

export class UserCreationError extends Error {}

export class UserUpdateError extends Error {}

export class UserAdministrationError extends Error {}

type AuditChanges = Record<string, { from: string; to: string }>;

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

function rethrowUserUpdateIdentityConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new UserUpdateError(
      "Employee number, username, or email already exists.",
    );
  }

  throw error;
}

function auditValue(value: string | null) {
  return value ?? "NONE";
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

export async function updateUserService(id: string, values: UpdateUserInput) {
  const session = await requirePermission(Permissions.USERS);

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await findNonArchivedUserForUpdate(id, transaction);

      if (!user) {
        throw new UserUpdateError("User not found.");
      }

      if (user.role === "TEACHER" || user.teacher) {
        throw new UserUpdateError(
          "Teacher accounts must be edited through Teacher Management.",
        );
      }

      const identities = await findUsersByIdentity(values, transaction);
      const conflicts = identities.filter(
        (identity) => identity.id !== user.id,
      );

      if (
        conflicts.some(
          ({ employeeNumber }) =>
            employeeNumber === values.employeeNumber,
        )
      ) {
        throw new UserUpdateError("Employee number already exists.");
      }

      if (conflicts.some(({ username }) => username === values.username)) {
        throw new UserUpdateError("Username already exists.");
      }

      if (conflicts.some(({ email }) => email === values.email)) {
        throw new UserUpdateError("Email already exists.");
      }

      const nextMiddleName = values.middleName || null;
      const changes: AuditChanges = {};
      const editableFields = {
        firstName: values.firstName,
        middleName: nextMiddleName,
        lastName: values.lastName,
        employeeNumber: values.employeeNumber,
        username: values.username,
        email: values.email,
        gender: values.gender,
      };

      for (const [field, nextValue] of Object.entries(editableFields)) {
        const previousValue = user[field as keyof typeof editableFields];

        if (previousValue !== nextValue) {
          changes[field] = {
            from: auditValue(previousValue),
            to: auditValue(nextValue),
          };
        }
      }

      const changedFields = Object.keys(changes);

      if (changedFields.length === 0) {
        throw new UserUpdateError("No changes to save.");
      }

      const updatedUser = await updateUser(
        user.id,
        editableFields,
        transaction,
      );

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "UPDATE",
            module: "User",
            recordId: updatedUser.id,
            recordName: `${updatedUser.lastName}, ${updatedUser.firstName}`,
            description: `Updated user account fields: ${changedFields.join(", ")}`,
            metadata: { changes },
          },
        ],
        transaction,
      );

      return updatedUser.id;
    });
  } catch (error) {
    if (error instanceof UserUpdateError) {
      throw error;
    }

    rethrowUserUpdateIdentityConflict(error);
  }
}

function assertAdministrativeUser(
  user: Awaited<ReturnType<typeof findNonArchivedUserForUpdate>>,
): asserts user is NonNullable<
  Awaited<ReturnType<typeof findNonArchivedUserForUpdate>>
> {
  if (!user) {
    throw new UserAdministrationError("User not found.");
  }

  if (user.role === "TEACHER" || user.teacher) {
    throw new UserAdministrationError(
      "Teacher accounts must be managed through Teacher Management.",
    );
  }
}

async function assertActiveSuperAdminRemains(
  user: { role: string; status: string },
  removesSuperAdmin: boolean,
  transaction: Prisma.TransactionClient,
) {
  if (
    removesSuperAdmin &&
    user.role === "SUPER_ADMIN" &&
    user.status === "ACTIVE" &&
    (await countActiveSuperAdmins(transaction)) <= 1
  ) {
    throw new UserAdministrationError(
      "At least one active Super Admin account must remain.",
    );
  }
}

export async function resetUserPasswordService(id: string) {
  const session = await requirePermission(Permissions.USERS);

  return await prisma.$transaction(async (transaction) => {
    const user = await findNonArchivedUserForUpdate(id, transaction);
    assertAdministrativeUser(user);

    if (user.id === session.user.id) {
      throw new UserAdministrationError(
        "Use Change Password to update your own password.",
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const update = await resetUserPassword(
      user.id,
      user.sessionVersion,
      passwordHash,
      transaction,
    );

    if (update.count !== 1) {
      throw new UserAdministrationError(
        "User credentials changed. Refresh and try again.",
      );
    }

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "PASSWORD_RESET",
          module: "User",
          recordId: user.id,
          recordName: `${user.lastName}, ${user.firstName}`,
          description: "Reset user account password and required first login.",
        },
      ],
      transaction,
    );

    return temporaryPassword;
  });
}

export async function changeUserStatusService(
  id: string,
  status: "ACTIVE" | "INACTIVE",
) {
  const session = await requirePermission(Permissions.USERS);

  return await prisma.$transaction(async (transaction) => {
    const user = await findNonArchivedUserForUpdate(id, transaction);
    assertAdministrativeUser(user);

    if (user.id === session.user.id) {
      throw new UserAdministrationError("You cannot change your own status.");
    }

    if (user.status === status) {
      throw new UserAdministrationError(`User is already ${status.toLowerCase()}.`);
    }

    await assertActiveSuperAdminRemains(user, status === "INACTIVE", transaction);

    const updatedUser = await updateUser(user.id, { status }, transaction);
    const action = status === "ACTIVE" ? "ACTIVATE" : "DEACTIVATE";

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action,
          module: "User",
          recordId: updatedUser.id,
          recordName: `${updatedUser.lastName}, ${updatedUser.firstName}`,
          description: `${action === "ACTIVATE" ? "Activated" : "Deactivated"} user account.`,
          metadata: {
            changes: {
              status: { from: user.status, to: status },
            },
          },
        },
      ],
      transaction,
    );

    return updatedUser.id;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function changeUserRoleService(
  id: string,
  role: "SUPER_ADMIN" | "REGISTRAR" | "PRINCIPAL",
) {
  const session = await requirePermission(Permissions.USERS);

  return await prisma.$transaction(async (transaction) => {
    const user = await findNonArchivedUserForUpdate(id, transaction);
    assertAdministrativeUser(user);

    if (user.id === session.user.id) {
      throw new UserAdministrationError("You cannot change your own role.");
    }

    if (user.role === role) {
      throw new UserAdministrationError("User already has this role.");
    }

    await assertActiveSuperAdminRemains(
      user,
      role !== "SUPER_ADMIN",
      transaction,
    );

    const updatedUser = await updateUser(user.id, { role }, transaction);

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "ROLE_CHANGE",
          module: "User",
          recordId: updatedUser.id,
          recordName: `${updatedUser.lastName}, ${updatedUser.firstName}`,
          description: `Changed user account role from ${user.role} to ${role}.`,
          metadata: {
            changes: {
              role: { from: user.role, to: role },
            },
          },
        },
      ],
      transaction,
    );

    return updatedUser.id;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
