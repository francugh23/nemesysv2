import { Badge } from "@/components/ui/badge";

import { StudentStatus } from "@/app/generated/prisma/client";

interface StatusBadgeProps {
  status: StudentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "ENROLLED":
      return (
        <Badge className="bg-green-100 text-green-500 hover:bg-green-200 border-green-200 border text-sm">
          Enrolled
        </Badge>
      );

    case "UNENROLLED":
      return (
        <Badge className="bg-amber-100 text-amber-500 hover:bg-amber-200 border-amber-200 border text-sm">
          Unenrolled
        </Badge>
      );

    case "GRADUATED":
      return <Badge className="bg-blue-100 text-blue-500 hover:bg-blue-200 border-blue-200 border text-sm">Graduated</Badge>;

    case "TRANSFERRED":
      return (
        <Badge className="bg-yellow-100 text-yellow-500 hover:bg-yellow-200 border-yellow-200 border text-sm">
          Transferred
        </Badge>
      );

    case "DROPPED":
      return <Badge variant="destructive" className="text-sm">
        Dropped
      </Badge>;

    default:
      return <Badge variant="outline" className="text-lg">
        {status}
      </Badge>;
  }
}