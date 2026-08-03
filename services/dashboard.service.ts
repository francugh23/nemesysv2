import { Permissions, requirePermission } from "@/lib/authorization";
import { getDashboardCounts } from "@/repositories/dashboard.repository";

export async function getDashboardData() {
  await requirePermission(Permissions.DASHBOARD);

  const counts = await getDashboardCounts();

  return counts;
}
