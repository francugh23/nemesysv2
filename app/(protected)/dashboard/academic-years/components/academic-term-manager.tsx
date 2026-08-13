"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useCreateAcademicTerm,
  useDeleteAcademicTerm,
  useAcademicTerms,
  useUpdateAcademicTerm,
} from "@/hooks/academic-term.hook";
import { formatDateOnly } from "@/lib/format";
import {
  CreateAcademicTermSchema,
  type AcademicTermListItem,
  type CreateAcademicTermInput,
} from "@/schemas";
import { AcademicTermBadge } from "@/components/common/badges";

export function AcademicTermManager({
  academicYearId,
  isDraft,
}: {
  academicYearId: string;
  isDraft: boolean;
}) {
  const { data: terms, isLoading } = useAcademicTerms(academicYearId);
  const [editingTerm, setEditingTerm] = useState<AcademicTermListItem | null>(null);
  const [termToRemove, setTermToRemove] = useState<AcademicTermListItem | null>(null);
  const [open, setOpen] = useState(false);

  function openCreate() {
    setEditingTerm(null);
    setOpen(true);
  }

  function openEdit(term: AcademicTermListItem) {
    setEditingTerm(term);
    setOpen(true);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Terms</h3>
          <p className="text-sm text-muted-foreground">
            {isDraft
              ? "Configure three non-overlapping terms before activating this academic year."
              : "Terms are preserved as read-only academic calendar history."}
          </p>
        </div>
        {isDraft && (
          <Button size="sm" onClick={openCreate}>
            <Plus />
            Add Term
          </Button>
        )}
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading terms...</p>
        ) : terms?.length ? (
          terms.map((term) => (
            <div
              key={term.id}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
            >
              <div>
                <AcademicTermBadge position={term.position} name={term.name} />
                <p className="text-sm text-muted-foreground">
                  {formatDateOnly(term.startDate)} to {formatDateOnly(term.endDate)}
                </p>
              </div>
              {isDraft && (
                <div className="flex items-center">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(term)}>
                    <Pencil />
                    <span className="sr-only">Edit {term.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setTermToRemove(term)}
                  >
                    <Trash2 />
                    <span className="sr-only">Remove {term.name}</span>
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No terms configured.</p>
        )}
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editingTerm ? "Edit Academic Term" : "Add Academic Term"}
        maxWidth="max-w-lg!"
      >
        <AcademicTermForm
          key={editingTerm?.id ?? "create"}
          academicYearId={academicYearId}
          term={editingTerm}
          onSuccess={() => setOpen(false)}
        />
      </FormDialog>
      <RemoveAcademicTermDialog
        academicYearId={academicYearId}
        term={termToRemove}
        onOpenChange={(nextOpen) => !nextOpen && setTermToRemove(null)}
      />
    </section>
  );
}

function RemoveAcademicTermDialog({
  academicYearId,
  term,
  onOpenChange,
}: {
  academicYearId: string;
  term: AcademicTermListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteTerm = useDeleteAcademicTerm();

  async function removeTerm() {
    if (!term) return;

    const result = await deleteTerm.mutateAsync({ id: term.id, academicYearId });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={Boolean(term)} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[95vw] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Academic Term</AlertDialogTitle>
          <AlertDialogDescription>
            Remove {term?.name}? This is available only while the Academic Year is a draft.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTerm.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteTerm.isPending}
            onClick={(event) => {
              event.preventDefault();
              void removeTerm();
            }}
          >
            {deleteTerm.isPending ? "Removing..." : "Remove Term"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AcademicTermForm({
  academicYearId,
  term,
  onSuccess,
}: {
  academicYearId: string;
  term: AcademicTermListItem | null;
  onSuccess: () => void;
}) {
  const createTerm = useCreateAcademicTerm();
  const updateTerm = useUpdateAcademicTerm();
  const form = useForm<CreateAcademicTermInput>({
    resolver: zodResolver(CreateAcademicTermSchema),
    defaultValues: term
      ? {
          name: term.name,
          position: term.position,
          startDate: term.startDate.toISOString().slice(0, 10),
          endDate: term.endDate.toISOString().slice(0, 10),
        }
      : { name: "", position: 1, startDate: "", endDate: "" },
  });
  const isPending = createTerm.isPending || updateTerm.isPending;

  async function onSubmit(values: CreateAcademicTermInput) {
    const result = term
      ? await updateTerm.mutateAsync({ id: term.id, academicYearId, values })
      : await createTerm.mutateAsync({ academicYearId, values });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onSuccess();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Field>
        <FieldLabel htmlFor="academic-term-name">Term Name</FieldLabel>
        <Input id="academic-term-name" {...form.register("name")} />
        <FieldError>{form.formState.errors.name?.message}</FieldError>
      </Field>
      <Field>
        <FieldLabel htmlFor="academic-term-position">Position</FieldLabel>
        <Input
          id="academic-term-position"
          type="number"
          min="1"
          {...form.register("position", { valueAsNumber: true })}
        />
        <FieldError>{form.formState.errors.position?.message}</FieldError>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="academic-term-start-date">Start Date</FieldLabel>
          <Input id="academic-term-start-date" type="date" {...form.register("startDate")} />
          <FieldError>{form.formState.errors.startDate?.message}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="academic-term-end-date">End Date</FieldLabel>
          <Input id="academic-term-end-date" type="date" {...form.register("endDate")} />
          <FieldError>{form.formState.errors.endDate?.message}</FieldError>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : term ? "Save Term" : "Add Term"}
        </Button>
      </div>
    </form>
  );
}
