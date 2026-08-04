import { hashPassword, verifyPassword } from "@/lib";
import { requireAuthenticatedUser } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  findActiveUserCredentialsById,
  updateActiveUserPassword,
} from "@/repositories/user.repository";
import type { ChangeOwnPasswordInput } from "@/schemas";

export class AccountPasswordError extends Error {}

export async function changeOwnPasswordService(
  values: ChangeOwnPasswordInput,
) {
  const session = await requireAuthenticatedUser();
  const user = await findActiveUserCredentialsById(session.user.id);

  if (!user || user.sessionVersion !== session.user.sessionVersion) {
    throw new AccountPasswordError("Your session is no longer valid.");
  }

  if (!(await verifyPassword(values.currentPassword, user.passwordHash))) {
    throw new AccountPasswordError("Current password is incorrect.");
  }

  if (await verifyPassword(values.newPassword, user.passwordHash)) {
    throw new AccountPasswordError(
      "New password must be different from the current password.",
    );
  }

  const passwordHash = await hashPassword(values.newPassword);
  const action = user.isFirstLogin
    ? "FIRST_LOGIN_COMPLETED"
    : "PASSWORD_CHANGE";

  await prisma.$transaction(async (transaction) => {
    const update = await updateActiveUserPassword(
      user.id,
      user.sessionVersion,
      passwordHash,
      transaction,
    );

    if (update.count !== 1) {
      throw new AccountPasswordError(
        "Account credentials changed. Sign in and try again.",
      );
    }

    await createAuditLogs(
      [
        {
          userId: user.id,
          action,
          module: "User",
          recordId: user.id,
          recordName: `${user.lastName}, ${user.firstName}`,
          description: user.isFirstLogin
            ? "Completed first-login password replacement."
            : "Changed own account password.",
        },
      ],
      transaction,
    );
  });
}
