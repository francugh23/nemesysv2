import { SubjectTableSkeleton } from "@/components/skeletons/subject-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Subject Records</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter and manage subjects.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <SubjectTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
