import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export interface UserListFilters {
  search?: string;
  role?: "SUPER_ADMIN" | "REGISTRAR" | "PRINCIPAL" | "TEACHER";
  status?: "ACTIVE" | "INACTIVE";
  firstLogin?: boolean;
}

const userListSelect = {
  id: true,
  employeeNumber: true,
  username: true,
  email: true,
  firstName: true,
  middleName: true,
  lastName: true,
  role: true,
  status: true,
  isFirstLogin: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

function getUserListWhere(filters: UserListFilters): Prisma.UserWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt: null,
    role: filters.role,
    status: filters.status,
    isFirstLogin: filters.firstLogin,
    AND: searchTerms.map((term) => ({
      OR: [
        { employeeNumber: { contains: term, mode: "insensitive" } },
        { username: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { middleName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}

export async function countNonArchivedUsers(filters: UserListFilters) {
  return prisma.user.count({
    where: getUserListWhere(filters),
  });
}

export async function findNonArchivedUsers(
  filters: UserListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.UserOrderByWithRelationInput[],
) {
  return prisma.user.findMany({
    where: getUserListWhere(filters),
    select: userListSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

export async function findUserFilterOptionValues() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      role: true,
      status: true,
      isFirstLogin: true,
    },
  });
}

export async function findUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: {
      username
    }
  })
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: {
      id
    }
  })
}

export async function findActiveUserById(id: string) {
  return prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
}

export async function findUserByEmployeeNumber(employeeNumber: string) {
  return prisma.user.findUnique({
    where: {
      employeeNumber,
    },
  });
}

export async function createUser(
  data: Prisma.UserCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).user.create({
    data,
  });
}

export async function updateUser(
  id: string,
  data: Prisma.UserUpdateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).user.update({
    where: {
      id,
    },
    data,
  });
}
