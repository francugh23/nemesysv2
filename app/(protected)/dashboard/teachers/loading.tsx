import { TeacherTableSkeleton } from "@/components/skeletons/teacher-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Teacher Records</h1>
        <p className="text-sm text-muted-foreground">
          View teacher profiles and account status.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <TeacherTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
