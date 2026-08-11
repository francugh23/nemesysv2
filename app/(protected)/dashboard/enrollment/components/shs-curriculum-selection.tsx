"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEligibleShsOfferingsForEnrollment, useSelectShsStudentCurriculum, useStudentSubjectEnrollments } from "@/hooks/student-subject-enrollment.hook";

type CurriculumSelection = {
  subjectOfferingId: string;
  academicTermIds: string[];
};

export function ShsCurriculumSelection({ enrollmentId, gradeLevel, enrollmentStatus, academicYearStatus, open }: { enrollmentId: string; gradeLevel: string; enrollmentStatus: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED"; academicYearStatus: "DRAFT" | "ACTIVE" | "LOCKED" | "ARCHIVED"; open: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: rows } = useStudentSubjectEnrollments(enrollmentId, open);
  const activeSelections = rows?.filter((row) => row.status === "ACTIVE").map((row) => ({
    subjectOfferingId: row.subjectOfferingId,
    academicTermIds: row.terms.map(({ academicTermId }) => academicTermId),
  })) ?? [];

  if (gradeLevel !== "11" && gradeLevel !== "12") return null;

  const operational = enrollmentStatus === "ACTIVE" && academicYearStatus === "ACTIVE";

  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">SSHS Curriculum Selection</h3>
          <p className="text-sm text-muted-foreground">
            {operational
              ? "Choose one or more configured Academic Terms for each school-approved offering. DepEd provisional references are not available to students."
              : `Selection is read-only because the Enrollment is ${enrollmentStatus} or its Academic Year is ${academicYearStatus}. Historical subject details remain available above.`}
          </p>
        </div>
        <Button size="sm" disabled={!operational} onClick={() => setDialogOpen(true)}>Select approved offerings</Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{activeSelections.length} active selection{activeSelections.length === 1 ? "" : "s"}.</p>
      {operational && dialogOpen && (
        <ShsCurriculumSelectionDialog
          enrollmentId={enrollmentId}
          open
          onOpenChange={setDialogOpen}
          initialSelections={activeSelections}
        />
      )}
    </section>
  );
}

function ShsCurriculumSelectionDialog({ enrollmentId, open, onOpenChange, initialSelections }: { enrollmentId: string; open: boolean; onOpenChange: (open: boolean) => void; initialSelections: CurriculumSelection[] }) {
  const [selections, setSelections] = useState<CurriculumSelection[]>(initialSelections);
  const eligible = useEligibleShsOfferingsForEnrollment(enrollmentId, open);
  const selection = useSelectShsStudentCurriculum(enrollmentId);
  const hasSelectionWithoutTerms = selections.some(({ academicTermIds }) => academicTermIds.length === 0);

  const toggleOffering = (subjectOfferingId: string, checked: boolean) => {
    setSelections((current) => checked
      ? [...current.filter((item) => item.subjectOfferingId !== subjectOfferingId), { subjectOfferingId, academicTermIds: [] }]
      : current.filter((item) => item.subjectOfferingId !== subjectOfferingId));
  };

  const toggleTerm = (subjectOfferingId: string, academicTermId: string, checked: boolean) => {
    setSelections((current) => current.map((item) => item.subjectOfferingId !== subjectOfferingId
      ? item
      : {
          ...item,
          academicTermIds: checked
            ? [...item.academicTermIds, academicTermId]
            : item.academicTermIds.filter((id) => id !== academicTermId),
        }));
  };

  const submit = async () => {
    const result = await selection.mutateAsync({ enrollmentId, selections });
    if (!result.error) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select School-Approved SSHS Offerings and Terms</DialogTitle>
          <DialogDescription>Changing an offering&apos;s Terms replaces its prior active snapshot. Historical records remain visible.</DialogDescription>
        </DialogHeader>
        {eligible.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div>
        ) : eligible.isError ? (
          <div className="rounded-lg border p-4 text-sm">
            <p className="font-medium">Unable to load approved SSHS offerings.</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void eligible.refetch()}>Try again</Button>
          </div>
        ) : eligible.data?.length ? (
          <div className="space-y-2">
            {eligible.data.map((offering) => {
              const selected = selections.find((item) => item.subjectOfferingId === offering.id);
              return (
                <div key={offering.id} className="rounded-lg border p-3">
                  <label className="flex cursor-pointer gap-3">
                    <Checkbox
                      checked={Boolean(selected)}
                      onCheckedChange={(value) => toggleOffering(offering.id, value === true)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-medium">{offering.subjectCode}</span>
                        <Badge>{offering.shsContext?.curriculumStatus}</Badge>
                        <Badge variant="outline">{offering.shsContext?.classification}</Badge>
                      </div>
                      <p className="mt-1">{offering.subjectDescription}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{offering.shsContext?.cluster ? `${offering.shsContext.cluster.code} | ${offering.shsContext.cluster.name}` : "Core subject"}</p>
                    </div>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-3 border-t pt-3">
                    {offering.terms.map((term) => (
                      <label key={term.academicTermId} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected?.academicTermIds.includes(term.academicTermId) ?? false}
                          disabled={!selected}
                          onCheckedChange={(value) => toggleTerm(offering.id, term.academicTermId, value === true)}
                        />
                        {term.academicTerm.position}. {term.academicTerm.name}
                      </label>
                    ))}
                  </div>
                  {selected?.academicTermIds.length === 0 && <p className="mt-2 text-sm text-destructive">Select at least one Academic Term for this offering.</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">No school-approved SSHS offerings are enabled for this enrollment&apos;s academic year and grade.</div>
        )}
        {selection.data?.error && <p className="text-sm text-destructive">{selection.data.error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={eligible.isLoading || selection.isPending || hasSelectionWithoutTerms} onClick={() => void submit()}>{selection.isPending ? "Saving..." : "Save selection"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
