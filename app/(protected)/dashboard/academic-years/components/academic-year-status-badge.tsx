import { Badge } from "@/components/ui/badge";
import type { AcademicYearListItem } from "@/schemas";

const statusVariants = {
  DRAFT: "outline",
  ACTIVE: "default",
  LOCKED: "secondary",
  ARCHIVED: "destructive",
} as const;

export function AcademicYearStatusBadge({
  status,
}: {
  status: AcademicYearListItem["status"];
}) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();

  return <Badge variant={statusVariants[status]}>{label}</Badge>;
}
