"use server";

import { auth } from "@/auth";
import { getSections } from "@/services/section.service";

export async function getSectionsAction() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }

  return await getSections();
}
