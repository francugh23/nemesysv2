import { SubjectTableSkeleton } from "@/components/skeletons/subject-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { SUBJECTS_DESCRIPTION } from "@/lib/academic-configuration";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Subjects</h1>
        <p className="text-sm text-muted-foreground">
          {SUBJECTS_DESCRIPTION}
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
