import prisma from "@/lib/prisma";

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