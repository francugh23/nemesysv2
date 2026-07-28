"use client";

import type { ReactNode } from "react";

interface CrudToolbarProps {
  primaryAction: ReactNode;
  actions?: ReactNode;
}

export function CrudToolbar({ primaryAction, actions }: CrudToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions}
      {primaryAction}
    </div>
  );
}
