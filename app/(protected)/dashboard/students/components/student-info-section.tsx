import { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StudentInfoSectionProps {
  title: string;
  children: ReactNode;
}

export function StudentInfoSection({
  title,
  children,
}: StudentInfoSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>
      </CardContent>
    </Card>
  );
}
