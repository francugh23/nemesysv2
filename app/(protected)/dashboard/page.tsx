"use client";

import { OperationalDashboard } from "@/components/dashboard/operational-dashboard";
import { useOperationalDashboard } from "@/hooks/dashboard-hook";

export default function DashboardPage() {
  const dashboard = useOperationalDashboard();

  return <OperationalDashboard {...dashboard} />;
}
