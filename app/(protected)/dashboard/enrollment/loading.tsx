import { EnrollmentTableSkeleton } from "@/components/skeletons/enrollment-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <EnrollmentTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
