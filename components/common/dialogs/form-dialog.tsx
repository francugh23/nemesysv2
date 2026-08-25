"use client";

import { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  maxWidth = "max-w-4xl!",
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex min-h-0 w-[95vw] ${maxWidth} max-h-[90dvh] flex-col overflow-hidden`}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
