import { AcademicYearTableSkeleton } from "@/components/skeletons/academic-year-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Academic Years</h1>
        <p className="text-sm text-muted-foreground">
          Create academic years and manage their lifecycle.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AcademicYearTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
