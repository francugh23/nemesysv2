import type { ReactNode } from "react";

export function SegmentedNavigation({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex w-fit flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
    >
      {children}
    </nav>
  );
}
