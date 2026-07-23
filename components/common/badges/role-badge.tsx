import { Badge } from "@/components/ui/badge";

import { UserRole } from "@/app/generated/prisma/client";

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  switch (role) {
    case "SUPER_ADMIN":
      return <Badge className="bg-red-600 hover:bg-red-600">Super Admin</Badge>;

    case "REGISTRAR":
      return <Badge className="bg-blue-600 hover:bg-blue-600">Registrar</Badge>;

    case "PRINCIPAL":
      return (
        <Badge className="bg-purple-600 hover:bg-purple-600">Principal</Badge>
      );

    case "TEACHER":
      return <Badge variant="secondary">Teacher</Badge>;

    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}
