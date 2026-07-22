"use client";

import { BookOpen, School, Users, UserSquare2 } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { useDashboard } from "@/hooks/dashboard-hook";

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  const dashboard = data ?? {
    students: 0,
    teachers: 0,
    sections: 0,
    subjects: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

        <p className="text-muted-foreground">Welcome to NEMESYS v2.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Students"
          value={isLoading ? "..." : dashboard.students}
          icon={Users}
        />

        <StatCard
          title="Teachers"
          value={isLoading ? "..." : dashboard.teachers}
          icon={UserSquare2}
        />

        <StatCard
          title="Sections"
          value={isLoading ? "..." : dashboard.sections}
          icon={School}
        />

        <StatCard
          title="Subjects"
          value={isLoading ? "..." : dashboard.subjects}
          icon={BookOpen}
        />
      </div>
    </div>
  );
}
