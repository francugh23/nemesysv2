import { Badge } from "@/components/ui/badge";

import { Gender } from "@/app/generated/prisma/client";

interface GenderBadgeProps {
  gender: Gender;
}

export function GenderBadge({ gender }: GenderBadgeProps) {
  return (
    <Badge variant="outline">{gender === "MALE" ? "Male" : "Female"}</Badge>
  );
}
