import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight">{value}</h2>

          {description && (
            <p className="mt-2 text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-6 text-primary" />
        </div>
      </div>
    </div>
  );
}