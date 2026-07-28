import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

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
