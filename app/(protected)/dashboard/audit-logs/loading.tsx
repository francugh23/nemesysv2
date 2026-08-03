import { AuditLogTableSkeleton } from "@/components/skeletons/audit-log-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Review immutable records of system activity.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <AuditLogTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
