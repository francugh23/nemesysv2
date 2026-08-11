import Link from "next/link";
import type { ReactNode } from "react";

const auditLogModuleRoutes: Record<string, string> = {
  Student: "/dashboard/students",
  Teacher: "/dashboard/teachers",
  Subject: "/dashboard/subjects",
  SubjectAssignment: "/dashboard/assignments",
  Section: "/dashboard/sections",
  Enrollment: "/dashboard/enrollment",
  User: "/dashboard/users",
  AcademicYear: "/dashboard/academic-years",
  AcademicTerm: "/dashboard/academic-years",
  SubjectOffering: "/dashboard/subject-offerings",
  ShsCurriculumCluster: "/dashboard/subject-offerings",
};

export function getAuditLogRecordHref(
  module: string,
  recordId: string | null,
  recordName: string | null,
) {
  const route = auditLogModuleRoutes[module];
  const search = recordName ?? recordId;

  if (!route || !search) {
    return null;
  }

  return `${route}?${new URLSearchParams({ q: search }).toString()}`;
}

export function AuditLogRecordLink({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  return href ? (
    <Link href={href} className="hover:underline">
      {children}
    </Link>
  ) : (
    children
  );
}
