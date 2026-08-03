import { Badge } from "@/components/ui/badge";

import { StudentStatus } from "@/app/generated/prisma/client";

interface StatusBadgeProps {
  status: StudentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "ENROLLED":
      return <Badge className="bg-green-600 hover:bg-green-600">Enrolled</Badge>;

    case "UNENROLLED":
      return <Badge className="bg-amber-600 hover:bg-amber-600">Unenrolled</Badge>;

    case "GRADUATED":
      return <Badge className="bg-blue-600 hover:bg-blue-600">Graduated</Badge>;

    case "TRANSFERRED":
      return (
        <Badge className="bg-yellow-600 hover:bg-yellow-600">
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