import { verifyPassword } from "@/lib";
import { findUserByUsername } from "../repositories/user.repository";
import prisma from "../lib/prisma";

export async function authenticateUser(username: string, password: string) {
  const user = await findUserByUsername(username);

  if (!user) {
    return null;
  }

  if (user.deletedAt) {
    return null;
  }

  if (user.status !== "ACTIVE") {
    return null;
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}
