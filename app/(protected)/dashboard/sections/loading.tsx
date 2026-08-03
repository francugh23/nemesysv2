import { SectionTableSkeleton } from "@/components/skeletons/section-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Section Records</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter and manage active sections.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SectionTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
