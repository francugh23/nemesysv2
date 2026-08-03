import { Skeleton } from "@/components/ui/skeleton";

export function AuditLogTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-md" />
        ))}
      </div>

      {Array.from({ length: 10 }).map((_, row) => (
        <div key={row} className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, column) => (
            <Skeleton key={column} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}
