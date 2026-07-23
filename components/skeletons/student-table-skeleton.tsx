import { Skeleton } from "@/components/ui/skeleton";

export function StudentTableSkeleton() {
  return (
    <div className="space-y-3">
      {/* Table Header */}
      <div className="grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-md" />
        ))}
      </div>

      {/* Table Rows */}
      {Array.from({ length: 10 }).map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}