import { verifyPassword } from "@/lib";
import {
  findUserCredentialsByUsername,
  recordUserLogin,
} from "@/repositories/user.repository";

export async function authenticateUser(username: string, password: string) {
  const user = await findUserCredentialsByUsername(username);

  if (!user) {
    return null;
  }

  if (user.deletedAt) {
    return null;
  }

  if (user.status !== "ACTIVE") {
    return null;
  }

  const { passwordHash, ...authenticatedUser } = user;
  const validPassword = await verifyPassword(password, passwordHash);

  if (!validPassword) {
    return null;
  }

  await recordUserLogin(user.id, new Date());

  return authenticatedUser;
}
