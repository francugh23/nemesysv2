import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import {
  countNonArchivedUsers,
  findNonArchivedUsers,
  findUserFilterOptionValues,
} from "@/repositories/user.repository";
import type {
  UserFilterOptions,
  UserPage,
  UserTableQuery,
} from "@/schemas";

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
