import { SectionTableSkeleton } from "@/components/skeletons/section-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <SectionTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
