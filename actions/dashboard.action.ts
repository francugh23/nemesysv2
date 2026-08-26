"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import { getOperationalDashboard, getOperationalDashboardSectionPage } from "@/services/dashboard.service";
import * as z from "zod";

export async function getOperationalDashboardAction() {
  await requirePermission(Permissions.OPERATIONAL_DASHBOARD);

  return getOperationalDashboard();
}

export async function getOperationalDashboardSectionPageAction(page: unknown) {
  await requirePermission(Permissions.OPERATIONAL_DASHBOARD);
  const parsed = z.number().int().min(1).safeParse(page);
  if (!parsed.success) throw new Error("Invalid dashboard section page.");

  return getOperationalDashboardSectionPage(parsed.data);
}
