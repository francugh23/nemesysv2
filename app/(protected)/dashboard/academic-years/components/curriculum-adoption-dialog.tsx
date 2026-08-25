"use client";

import { useState } from "react";
import { ArrowRight, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AcademicYearStatusBadge } from "@/app/(protected)/dashboard/academic-years/components/academic-year-status-badge";
import { AcademicTermBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCommitCurriculumAdoption,
  useCurriculumAdoptionOptions,
  useCurriculumAdoptionPreview,
} from "@/hooks/curriculum-adoption.hook";
import type {
  AcademicYearListItem,
  CurriculumAdoptionPreviewInput,
} from "@/schemas";

export function CurriculumAdoptionDialog({
  academicYear,
  open,
  onOpenChange,
}: {
  academicYear: AcademicYearListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sourceAcademicYearId, setSourceAcademicYearId] = useState("");
  const [termMappingBySourceId, setTermMappingBySourceId] = useState<
    Record<string, string>
  >({});
  const [previewInput, setPreviewInput] =
    useState<CurriculumAdoptionPreviewInput | null>(null);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<Set<string>>(
    new Set(),
  );
  const [confirming, setConfirming] = useState(false);
  const optionsQuery = useCurriculumAdoptionOptions(academicYear.id, open);
  const previewQuery = useCurriculumAdoptionPreview(previewInput);
  const adoption = useCommitCurriculumAdoption();
  const optionsResult = optionsQuery.data;
  const options =
    optionsResult && "data" in optionsResult ? optionsResult.data : null;
  const sourceYear = options?.sourceYears.find(
    ({ id }) => id === sourceAcademicYearId,
  );
  const previewResult = previewQuery.data;
  const preview =
    previewResult && "data" in previewResult ? previewResult.data : null;
  const optionsError =
    optionsResult && "error" in optionsResult ? optionsResult.error : null;
  const previewError =
    previewResult && "error" in previewResult ? previewResult.error : null;
  const destinationTerms = options?.destinationYear.terms ?? [];
  const mappingsComplete = Boolean(
    sourceYear?.terms.length &&
      sourceYear.terms.length === destinationTerms.length &&
      sourceYear.terms.every((term) => termMappingBySourceId[term.id]) &&
      new Set(Object.values(termMappingBySourceId)).size ===
        sourceYear.terms.length,
  );
  const previewRows = preview
    ? [
        ...preview.rows.eligible.map((row) => ({ row, status: "Eligible" })),
        ...preview.rows.conflicts.map((row) => ({ row, status: "Conflict" })),
        ...preview.rows.ineligible.map((row) => ({ row, status: "Ineligible" })),
        ...preview.rows.excluded.map((row) => ({ row, status: "Archived" })),
      ]
    : [];

  function resetPreview() {
    setPreviewInput(null);
    setSelectedOfferingIds(new Set());
    setConfirming(false);
  }

  function handleSourceChange(value: string | null) {
    setSourceAcademicYearId(value ?? "");
    setTermMappingBySourceId({});
    resetPreview();
  }

  function handleMappingChange(sourceTermId: string, value: string | null) {
    setTermMappingBySourceId((current) => ({
      ...current,
      [sourceTermId]: value ?? "",
    }));
    resetPreview();
  }

  function handlePreview() {
    if (!sourceYear || !mappingsComplete) return;
    const input = {
      sourceAcademicYearId: sourceYear.id,
      destinationAcademicYearId: academicYear.id,
      termMappings: sourceYear.terms.map((term) => ({
        sourceAcademicTermId: term.id,
        destinationAcademicTermId: termMappingBySourceId[term.id],
      })),
    };
    setPreviewInput(input);
    setSelectedOfferingIds(new Set());
    setConfirming(false);
  }

  function toggleOffering(id: string, selected: boolean) {
    setSelectedOfferingIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
    setConfirming(false);
  }

  function toggleAllEligible(selected: boolean) {
    setSelectedOfferingIds(
      selected && preview
        ? new Set(preview.rows.eligible.map((row) => row.sourceOfferingId))
        : new Set(),
    );
    setConfirming(false);
  }

  async function handleAdopt() {
    if (!previewInput || selectedOfferingIds.size === 0) return;
    try {
      const result = await adoption.mutateAsync({
        ...previewInput,
        selectedSourceOfferingIds: [...selectedOfferingIds],
      });
      if ("error" in result) {
        toast.error(result.error);
        setConfirming(false);
        void previewQuery.refetch();
        return;
      }
      toast.success(result.success);
      handleOpenChange(false);
    } catch {
      toast.error("Unable to adopt the Curriculum. Try again.");
      setConfirming(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && adoption.isPending) return;
    if (!nextOpen) {
      setSourceAcademicYearId("");
      setTermMappingBySourceId({});
      resetPreview();
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-6xl! flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Copy className="size-5" /> Adopt Curriculum
          </DialogTitle>
          <DialogDescription>
            Copy selected Subject Offerings into {academicYear.label}. Subjects are
            reused, and no Enrollment or student records are copied. Copied SHS
            Curriculum requires destination-year review and approval before student use.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-6 py-5">
            <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="curriculum-source-year">
                  Source Academic Year
                </label>
                <Select
                  value={sourceAcademicYearId || null}
                  onValueChange={handleSourceChange}
                  disabled={optionsQuery.isLoading || adoption.isPending}
                >
                  <SelectTrigger id="curriculum-source-year" className="w-full">
                    <SelectValue placeholder="Select a previous or current year" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.sourceYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.label} ({year.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ArrowRight className="mx-auto hidden size-5 text-muted-foreground md:block" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Destination Academic Year</p>
                <div className="flex h-8 items-center justify-between rounded-lg border bg-background px-3">
                  <span className="font-medium">{academicYear.label}</span>
                  <AcademicYearStatusBadge status={academicYear.status} />
                </div>
              </div>
            </div>

            {optionsQuery.isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading available Academic Years...
              </p>
            )}
            {(optionsQuery.isError || optionsError) && (
              <InlineError message={optionsError ?? "Unable to load adoption options."} />
            )}
            {options && options.sourceYears.length === 0 && (
              <InlineError message="No active, locked, or archived source Academic Year is available." />
            )}

            {sourceYear && (
              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold">Explicit Academic Term Mapping</h3>
                  <p className="text-sm text-muted-foreground">
                    Map every source Term to one unique destination Term. No mapping is inferred.
                  </p>
                </div>
                {sourceYear.terms.length !== destinationTerms.length ? (
                  <InlineError message="Source and destination years must have the same number of configured Terms." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {sourceYear.terms.map((sourceTerm) => (
                      <div key={sourceTerm.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border p-3">
                        <AcademicTermBadge
                          position={sourceTerm.position}
                          name={sourceTerm.name}
                        />
                        <ArrowRight className="size-4 text-muted-foreground" />
                        <Select
                          value={termMappingBySourceId[sourceTerm.id] || null}
                          onValueChange={(value) => handleMappingChange(sourceTerm.id, value)}
                          disabled={adoption.isPending}
                        >
                            <SelectTrigger className="w-full" aria-label={`Destination Term for Term ${sourceTerm.position}: ${sourceTerm.name}`}>
                            <SelectValue placeholder="Choose Term" />
                          </SelectTrigger>
                          <SelectContent>
                            {destinationTerms.map((destinationTerm) => {
                              const usedByAnother = Object.entries(termMappingBySourceId).some(
                                ([sourceId, destinationId]) =>
                                  sourceId !== sourceTerm.id && destinationId === destinationTerm.id,
                              );
                              return (
                                <SelectItem key={destinationTerm.id} value={destinationTerm.id} disabled={usedByAnother}>
                                  Term {destinationTerm.position}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={handlePreview} disabled={!mappingsComplete || previewQuery.isFetching}>
                  {previewQuery.isFetching ? "Checking Curriculum..." : "Preview Curriculum"}
                </Button>
              </section>
            )}

            {previewError && <InlineError message={previewError} />}
            {previewQuery.isError && (
              <InlineError message="Unable to check the source Curriculum. Try again." />
            )}

            {preview && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Curriculum Preview</h3>
                    <p className="text-sm text-muted-foreground">
                      Select eligible Offerings. Conflicts, invalid records, and archived source Offerings cannot be copied.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{preview.summary.eligible} eligible</Badge>
                    <Badge variant="destructive">{preview.summary.conflicts} conflicts</Badge>
                    <Badge variant="outline">{preview.summary.ineligible} ineligible</Badge>
                    <Badge variant="secondary">{preview.summary.excluded} archived</Badge>
                  </div>
                </div>

                {preview.rows.eligible.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <Checkbox
                      checked={selectedOfferingIds.size === preview.rows.eligible.length}
                      onCheckedChange={toggleAllEligible}
                    />
                    <span className="text-sm font-medium">Select all eligible Offerings</span>
                  </div>
                )}

                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Copy</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Destination Terms</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map(({ row, status }) => {
                        const eligible = status === "Eligible";
                        return (
                          <TableRow key={row.sourceOfferingId}>
                            <TableCell>
                              <Checkbox
                                aria-label={`Copy ${row.subjectCode}`}
                                checked={selectedOfferingIds.has(row.sourceOfferingId)}
                                disabled={!eligible}
                                onCheckedChange={(checked) => toggleOffering(row.sourceOfferingId, checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{row.subjectCode}</p>
                              <p className="max-w-64 truncate text-xs text-muted-foreground">{row.subjectDescription}</p>
                            </TableCell>
                            <TableCell>{row.gradeLevel}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {row.mappedTerms.map(({ destination }) => (
                                  <AcademicTermBadge
                                    key={destination.id}
                                    position={destination.position}
                                    name={destination.name}
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status === "Conflict" ? "destructive" : status === "Eligible" ? "default" : "outline"}>
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-80 whitespace-normal text-xs text-muted-foreground">
                              {row.reasons.map(({ message }) => message).join(" ")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}

            {confirming && preview && (
              <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Confirm atomic Curriculum adoption</p>
                  <p className="text-sm">
                    This will create {selectedOfferingIds.size} active Subject Offering{selectedOfferingIds.size === 1 ? "" : "s"} in {academicYear.label}. Copied SHS Curriculum does not carry school approval and requires destination-year approval before student use. Any stale record or new conflict will roll back the entire operation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mx-0 mb-0 rounded-none px-6">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={adoption.isPending}>
            Cancel
          </Button>
          {preview && !confirming && (
            <Button disabled={selectedOfferingIds.size === 0} onClick={() => setConfirming(true)}>
              Review {selectedOfferingIds.size} Offering{selectedOfferingIds.size === 1 ? "" : "s"}
            </Button>
          )}
          {preview && confirming && (
            <Button disabled={adoption.isPending} onClick={() => void handleAdopt()}>
              {adoption.isPending ? "Adopting Curriculum..." : "Confirm Adoption"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
