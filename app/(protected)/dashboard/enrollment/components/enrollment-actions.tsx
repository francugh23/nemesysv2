"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EnrollmentListItem } from "@/schemas";

interface EnrollmentActionsProps {
  enrollment: EnrollmentListItem;
  onTransition: (
    enrollment: EnrollmentListItem,
    status: "COMPLETED" | "DROPPED" | "TRANSFERRED",
  ) => void;
}

export function EnrollmentActions({
  enrollment,
  onTransition,
}: EnrollmentActionsProps) {
  const operational =
    enrollment.status === "ACTIVE" &&
    enrollment.academicYearStatus === "ACTIVE";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!operational}
          onClick={(event) => {
            event.stopPropagation();
            onTransition(enrollment, "COMPLETED");
          }}
        >
          Mark completed
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!operational}
          onClick={(event) => {
            event.stopPropagation();
            onTransition(enrollment, "DROPPED");
          }}
        >
          Withdraw / Unenroll
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!operational}
          onClick={(event) => {
            event.stopPropagation();
            onTransition(enrollment, "TRANSFERRED");
          }}
        >
          Mark transferred
        </DropdownMenuItem>
        {!operational ? (
          <DropdownMenuItem disabled>
            {enrollment.status !== "ACTIVE"
              ? `${enrollment.status} is terminal`
              : "Academic year is read-only"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
