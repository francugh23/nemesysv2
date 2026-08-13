import { Badge } from "@/components/ui/badge";

interface AcademicTermBadgeProps {
  position: number;
  name?: string;
}

const termClassNames: Record<number, string> = {
  1: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  2: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  3: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

export function AcademicTermBadge({
  position,
  name,
}: AcademicTermBadgeProps) {
  const label = `Term ${position}`;
  const className = termClassNames[position];

  return (
    <Badge
      variant={className ? undefined : "outline"}
      className={className}
      aria-label={name ? `${label}: ${name}` : label}
      title={name ? `${label}: ${name}` : label}
    >
      {label}
    </Badge>
  );
}
