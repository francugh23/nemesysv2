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
  gender: true,
  role: true,
  status: true,
  isFirstLogin: true,
  createdAt: true,
  teacher: {
    select: {
      id: true,
    },
  },
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
  const users = await prisma.user.findMany({
    where: getUserListWhere(filters),
    select: userListSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });

  return users.map(({ teacher, ...user }) => ({
    ...user,
    isTeacherOwned: teacher !== null,
  }));
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
      username,
    },
    select: {
      id: true,
    },
  });
}

export async function findUserCredentialsByUsername(username: string) {
  return prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });
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
    select: {
      id: true,
    },
  });
}

export async function findUserByEmployeeNumber(employeeNumber: string) {
  return prisma.user.findUnique({
    where: {
      employeeNumber,
    },
    select: {
      id: true,
    },
  });
}

export async function findNonArchivedUserForUpdate(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).user.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      employeeNumber: true,
      username: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      gender: true,
      role: true,
      status: true,
      teacher: {
        select: {
          id: true,
        },
      },
    },
  });
}

export async function countActiveSuperAdmins(
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).user.count({
    where: {
      deletedAt: null,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
}

export async function findUsersByIdentity(
  identity: {
    employeeNumber: string;
    username: string;
    email: string;
  },
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).user.findMany({
    where: {
      OR: [
        { employeeNumber: identity.employeeNumber },
        { username: identity.username },
        { email: identity.email },
      ],
    },
    select: {
      id: true,
      employeeNumber: true,
      username: true,
      email: true,
    },
  });
}

export async function createUser(
  data: Prisma.UserCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).user.create({
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
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
    select: {
      id: true,
      employeeNumber: true,
      username: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      gender: true,
      role: true,
      status: true,
    },
  });
}

export async function recordUserLogin(id: string, lastLoginAt: Date) {
  return prisma.user.update({
    where: { id },
    data: { lastLoginAt },
    select: { id: true },
  });
}
