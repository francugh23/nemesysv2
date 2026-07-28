"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  description?: string;
  confirmLabel: string;
  confirmValue: string;
  itemLabel: string;
  itemName: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  canConfirm?: boolean;
  isDeleting?: boolean;
  actionLabel?: string;
  processingLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmValue,
  itemLabel,
  itemName,
  inputValue,
  onInputChange,
  canConfirm,
  isDeleting = false,
  actionLabel = "Delete",
  processingLabel = "Deleting...",
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const isConfirmed = canConfirm ?? inputValue === confirmValue;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[95vw] max-w-md rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {description ?? "This action cannot be undone."}
            </span>
            <span className="block">{confirmLabel}</span>
            <span className="block font-semibold text-destructive">
              {confirmValue}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <div className="text-sm font-medium">{itemLabel}</div>
          <div className="rounded-md border bg-muted px-3 py-2 text-sm">
            {itemName}
          </div>
          <Input
            placeholder={`Enter ${itemLabel}`}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
          />
        </div>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <AlertDialogCancel className="w-full sm:w-auto">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!isConfirmed || isDeleting}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="w-full text-white bg-destructive hover:bg-destructive/90 sm:w-auto"
          >
            {isDeleting ? processingLabel : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
