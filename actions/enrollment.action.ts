"use server";

import { auth } from "@/auth";
import { getEnrollments } from "@/services/enrollment.service";

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }
}

export async function getEnrollmentsAction() {
  await requireSuperAdmin();

  return await getEnrollments();
}
