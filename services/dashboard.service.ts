import { getDashboardCounts } from "@/repositories/dashboard.repository";

export async function getDashboardData() {
  const counts = await getDashboardCounts();

  return counts;
}
