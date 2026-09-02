"use client";

import { useEffect, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";

import type { getAssignmentMatrixAction } from "@/actions/subject-assignment.action";
import type { AssignmentMatrixMutation } from "@/schemas";
import { matchesMatrixCoverageFilter, projectMatrixCell, summarizeProjectedCells, type MatrixCoverageFilter } from "@/lib/assignment-matrix-projection";
import { useMutateAssignmentMatrix, useSubjectAssignmentOptions } from "@/hooks/subject-assignment.hook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Matrix = Awaited<ReturnType<typeof getAssignmentMatrixAction>>;
type Offering = Matrix["offerings"][number];
type Cell = Offering["cells"][number];
type Detail = { cell: Cell; offering: Offering; section: Matrix["sections"][number] };

const cellKey = (offeringId: string, sectionId: string) => `${offeringId}:${sectionId}`;

function termScope(detail: Detail, term: Cell["termAssignments"][number]) {
  return {
    subjectOfferingId: detail.offering.id,
    academicTermId: term.academicTermId,
    sectionId: detail.section.id,
    expectedAssignmentId: term.assignmentId,
  };
}

function termStatus(term: Cell["termAssignments"][number]) {
  if (term.protectedOwnership) return "Protected";
  if (term.assignmentId) return "Editable";
  return term.termHasStarted ? "Initial assignment allowed" : "Assignable";
}

function CellDialog({ detail, matrix, onClose }: { detail: Detail | null; matrix: Matrix; onClose: () => void }) {
  const [teacherId, setTeacherId] = useState("");
  const [selectedTerms, setSelectedTerms] = useState<string[]>(() => detail?.cell.termAssignments.filter((term) => term.initialAssignmentAllowed).map((term) => term.academicTermId) ?? []);
  const [error, setError] = useState<string | null>(null);
  const options = useSubjectAssignmentOptions();
  const mutation = useMutateAssignmentMatrix();
  const editableTerms = detail?.cell.termAssignments.filter((term) => term.initialAssignmentAllowed || term.ownershipEditable) ?? [];
  const clearableTerms = detail?.cell.termAssignments.filter((term) => term.assignmentId && term.ownershipEditable) ?? [];

  function toggleTerm(termId: string, checked: boolean) {
    setSelectedTerms((current) => checked ? [...new Set([...current, termId])] : current.filter((id) => id !== termId));
  }

  async function assign() {
    if (!detail || !teacherId || !selectedTerms.length) return;
    setError(null);
    const result = await mutation.mutateAsync({ action: "ASSIGN", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, teacherId, scopes: detail.cell.termAssignments.filter((term) => selectedTerms.includes(term.academicTermId)).map((term) => termScope(detail, term)) });
    if (result.error) setError(result.error);
    else onClose();
  }

  async function clear() {
    if (!detail) return;
    const scopes = clearableTerms.filter((term) => selectedTerms.includes(term.academicTermId)).map((term) => termScope(detail, term));
    if (!scopes.length) return;
    setError(null);
    const result = await mutation.mutateAsync({ action: "CLEAR", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, scopes });
    if (result.error) setError(result.error);
    else onClose();
  }

  function onOpenChange(open: boolean) {
    if (!open) {
      setTeacherId("");
      setSelectedTerms([]);
      setError(null);
      onClose();
    }
  }

  return <Dialog open={Boolean(detail)} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden">
      <DialogHeader className="shrink-0">
        <DialogTitle>{detail ? `${detail.offering.subjectCode} / ${detail.section.sectionName}` : "Teaching assignment"}</DialogTitle>
        <DialogDescription>Choose exact editable Terms. Started assigned ownership is protected; unassigned started Terms permit an initial assignment.</DialogDescription>
      </DialogHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 pr-4">
          {detail?.cell.termAssignments.map((term) => {
            const editable = term.initialAssignmentAllowed || term.ownershipEditable;
            return <label key={term.academicTermId} className="flex gap-3 rounded-md border p-3 text-sm">
              <Checkbox checked={selectedTerms.includes(term.academicTermId)} disabled={!editable} onCheckedChange={(checked) => toggleTerm(term.academicTermId, checked === true)} />
              <span className="space-y-1"><span className="block font-medium">{term.academicTermName}</span><span className="block">{term.teacher ? `${term.teacher.employeeNumber ?? ""} ${term.teacher.name}` : "Unassigned"}</span><span className="block text-muted-foreground">{termStatus(term)}</span></span>
            </label>;
          })}
          {!editableTerms.length && <p className="text-sm text-muted-foreground">Every displayed Term is protected.</p>}
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="matrix-teacher">Teacher</label><Select value={teacherId} onValueChange={(value) => setTeacherId(value ?? "")}><SelectTrigger id="matrix-teacher"><SelectValue placeholder="Select active Teacher" /></SelectTrigger><SelectContent>{options.data?.teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.employeeNumber ? `${teacher.employeeNumber} - ` : ""}{teacher.lastName}, {teacher.firstName}</SelectItem>)}</SelectContent></Select></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </ScrollArea>
      <DialogFooter className="shrink-0"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" variant="outline" disabled={!clearableTerms.some((term) => selectedTerms.includes(term.academicTermId)) || mutation.isPending} onClick={() => void clear()}>Clear selected Terms</Button><Button type="button" disabled={!teacherId || !selectedTerms.length || mutation.isPending} onClick={() => void assign()}>{mutation.isPending ? "Applying..." : "Assign selected Terms"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function AssignmentMatrix({ matrix, termId }: { matrix: Matrix; termId: string | null }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Record<string, Detail>>({});
  const [bulkTeacherId, setBulkTeacherId] = useState("");
  const [copySource, setCopySource] = useState<Detail | null>(null);
  const [coverageFilter, setCoverageFilter] = useState<MatrixCoverageFilter>("ALL");
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ value: AssignmentMatrixMutation; title: string; scopeLabels: string[] } | null>(null);
  const options = useSubjectAssignmentOptions();
  const mutation = useMutateAssignmentMatrix();
  const previousContext = useRef<{ gradeLevel: string; termId: string | null; coverageFilter: MatrixCoverageFilter } | null>(null);
  const effectiveCoverageFilter = termId && coverageFilter === "MIXED_BY_TERM" ? "ALL" : coverageFilter;

  useEffect(() => {
    const context = { gradeLevel: matrix.gradeLevel, termId, coverageFilter: effectiveCoverageFilter };
    const previous = previousContext.current;
    previousContext.current = context;
    if (!previous || (previous.gradeLevel === context.gradeLevel && previous.termId === context.termId && previous.coverageFilter === context.coverageFilter)) return;
    const reason = previous.gradeLevel !== context.gradeLevel ? "Grade" : previous.termId !== context.termId ? "Term view" : "coverage filter";
    const selectedCount = Object.keys(selectedCells).length;
    setSelectedCells({});
    setCopySource(null);
    setDetail(null);
    setAnnouncement(`${selectedCount ? `${selectedCount} selected cell${selectedCount === 1 ? "" : "s"} cleared` : "Selection cleared"} because the ${reason} changed.`);
  }, [effectiveCoverageFilter, matrix.gradeLevel, selectedCells, termId]);

  const projectedOfferings = matrix.offerings.map((offering) => ({
    ...offering,
    cells: offering.cells.map((cell) => ({ ...cell, ...projectMatrixCell(cell, termId) })).filter((cell) => cell.termAssignments.length > 0),
  })).filter((offering) => offering.cells.length > 0);
  const projectedCells = projectedOfferings.flatMap((offering) => offering.cells);
  const coverage = summarizeProjectedCells(projectedCells);
  const visibleDetails = projectedOfferings.flatMap((offering) => offering.cells.map((cell, index) => ({ cell, offering, section: matrix.sections.find((section) => section.id === cell.sectionId) ?? matrix.sections[index] })).filter((item) => item.section && matchesMatrixCoverageFilter(item.cell, effectiveCoverageFilter))) as Detail[];
  const visibleKeys = new Set(visibleDetails.map((item) => cellKey(item.offering.id, item.section.id)));
  const selected = Object.values(selectedCells).filter((item) => visibleKeys.has(cellKey(item.offering.id, item.section.id)));
  const actionableScopeCount = selected.flatMap((item) => item.cell.termAssignments).filter((term) => term.initialAssignmentAllowed || term.ownershipEditable).length;

  function toggleCell(item: Detail, checked: boolean) {
    const key = cellKey(item.offering.id, item.section.id);
    setSelectedCells((current) => {
      if (!checked) { const remaining = { ...current }; delete remaining[key]; return remaining; }
      return { ...current, [key]: item };
    });
  }

  function selectAllVisible() {
    const visibleActionableScopeCount = visibleDetails.flatMap((item) => item.cell.termAssignments).filter((term) => term.initialAssignmentAllowed || term.ownershipEditable).length;
    setSelectedCells(Object.fromEntries(visibleDetails.map((item) => [cellKey(item.offering.id, item.section.id), item])));
    setAnnouncement(`${visibleDetails.length} visible cell${visibleDetails.length === 1 ? "" : "s"} selected, ${visibleActionableScopeCount} actionable assignment scope${visibleActionableScopeCount === 1 ? "" : "s"}.`);
  }

  function clearSelection() {
    setSelectedCells({});
    setCopySource(null);
    setAnnouncement("Selection and copy source cleared.");
  }

  function fillSelected() {
    if (!bulkTeacherId || !selected.length) return;
    const scopes = selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.initialAssignmentAllowed || term.ownershipEditable).map((term) => termScope(item, term)));
    if (!scopes.length) return;
    setPreview({ value: { action: "ASSIGN", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, teacherId: bulkTeacherId, scopes }, title: "Fill selected cells", scopeLabels: selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.initialAssignmentAllowed || term.ownershipEditable).map((term) => `${item.offering.subjectCode} / ${item.section.sectionName} / ${term.academicTermName}`)) });
  }

  function clearSelected() {
    const scopes = selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.assignmentId && term.ownershipEditable).map((term) => termScope(item, term)));
    if (!scopes.length) return;
    setPreview({ value: { action: "CLEAR", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, scopes }, title: "Clear selected future scopes", scopeLabels: selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.assignmentId && term.ownershipEditable).map((term) => `${item.offering.subjectCode} / ${item.section.sectionName} / ${term.academicTermName}`)) });
  }

  function copyToSelected() {
    if (!copySource) return;
    const destinations = selected.filter((item) => item.offering.id === copySource.offering.id && item.section.id !== copySource.section.id);
    const sourceScopes = copySource.cell.termAssignments.filter((term) => term.assignmentId).map((term) => termScope(copySource, term));
    const destinationScopes = destinations.flatMap((item) => item.cell.termAssignments.filter((term) => (term.initialAssignmentAllowed || term.ownershipEditable) && sourceScopes.some((source) => source.academicTermId === term.academicTermId)).map((term) => termScope(item, term)));
    if (!sourceScopes.length || !destinationScopes.length) { setError("Select editable destination cells for this Offering and a source cell with assignments."); return; }
    setPreview({ value: { action: "COPY", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, sourceScopes, destinationScopes }, title: "Copy teaching ownership", scopeLabels: destinations.flatMap((item) => item.cell.termAssignments.filter((term) => (term.initialAssignmentAllowed || term.ownershipEditable) && sourceScopes.some((source) => source.academicTermId === term.academicTermId)).map((term) => `${item.offering.subjectCode} / ${item.section.sectionName} / ${term.academicTermName}`)) });
  }

  async function confirmPreview() {
    if (!preview) return;
    setError(null);
    const result = await mutation.mutateAsync(preview.value);
    if (result.error) setError(result.error);
    else { setSelectedCells({}); setCopySource(null); setPreview(null); setAnnouncement("Teaching assignment changes applied. Selection cleared."); }
  }

  return <>
    <div aria-live="polite" className="sr-only">{announcement}</div>
    <div aria-live="polite" className="sr-only">{selected.length} selected cells, {actionableScopeCount} actionable assignment scopes.</div>
    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Expected assignment scopes</div><div className="font-medium">{coverage.expectedScopes}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Assigned assignment scopes</div><div className="font-medium">{coverage.assignedScopes}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Missing assignment scopes</div><div className="font-medium">{coverage.missingScopes}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Coverage</div><div className="font-medium">{coverage.coveragePercent === null ? "Not applicable" : `${coverage.coveragePercent.toFixed(1)}%`}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Complete cells</div><div className="font-medium">{coverage.completeCells}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Partially covered cells</div><div className="font-medium">{coverage.partiallyCoveredCells}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Mixed-by-Term cells</div><div className="font-medium">{coverage.mixedCells}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Protected assigned scopes</div><div className="font-medium">{coverage.protectedScopes}</div></div>
      <div className="rounded-md border p-3"><div className="text-muted-foreground">Started unassigned scopes</div><div className="font-medium">{coverage.startedUnassignedScopes}</div></div>
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <div className="space-y-1"><label className="text-sm font-medium" htmlFor="matrix-coverage-filter">Coverage filter</label><Select value={effectiveCoverageFilter} onValueChange={(value) => setCoverageFilter(value as MatrixCoverageFilter)}><SelectTrigger id="matrix-coverage-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All cells</SelectItem><SelectItem value="MISSING">Missing</SelectItem><SelectItem value="ASSIGNED">Assigned</SelectItem><SelectItem value="MIXED_BY_TERM" disabled={Boolean(termId)}>Mixed by Term{termId ? " (All Terms only)" : ""}</SelectItem><SelectItem value="PROTECTED">Protected</SelectItem></SelectContent></Select></div>
      <Button type="button" variant={selectionMode ? "secondary" : "outline"} onClick={() => setSelectionMode((current) => !current)}>Select cells</Button>
      {selectionMode && <><Button type="button" variant="outline" disabled={!visibleDetails.length} onClick={selectAllVisible}>Select all visible</Button><Button type="button" variant="outline" disabled={!selected.length && !copySource} onClick={clearSelection}>Clear selection</Button><span className="text-sm text-muted-foreground">{selected.length} cell{selected.length === 1 ? "" : "s"} selected, {actionableScopeCount} actionable assignment scope{actionableScopeCount === 1 ? "" : "s"}</span><Select value={bulkTeacherId} onValueChange={(value) => setBulkTeacherId(value ?? "")}><SelectTrigger aria-label="Teacher for selected cells"><SelectValue placeholder="Active Teacher" /></SelectTrigger><SelectContent>{options.data?.teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.employeeNumber ? `${teacher.employeeNumber} - ` : ""}{teacher.lastName}, {teacher.firstName}</SelectItem>)}</SelectContent></Select><Button type="button" disabled={!bulkTeacherId || !actionableScopeCount || mutation.isPending} onClick={() => void fillSelected()}>Fill selected</Button><Button type="button" variant="outline" disabled={!selected.some((item) => item.cell.termAssignments.some((term) => term.assignmentId && term.ownershipEditable)) || mutation.isPending} onClick={() => void clearSelected()}>Clear selected future scopes</Button><Button type="button" variant="outline" disabled={!copySource || !selected.length || mutation.isPending} onClick={() => void copyToSelected()}>Copy to selected Sections</Button>{copySource && <span className="text-sm text-muted-foreground">Copy source: {copySource.offering.subjectCode} / {copySource.section.sectionName}</span>}</>}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
    {!projectedOfferings.length || !matrix.sections.length ? <div className="mt-4 rounded-md border p-8 text-center text-sm text-muted-foreground">No eligible Curriculum Offerings or organizational Sections exist for Grade {matrix.gradeLevel}.</div> : <div className="mt-4 overflow-x-auto rounded-md border"><Table className="min-w-max"><TableHeader><TableRow><TableHead className="sticky left-0 z-10 bg-background">Offering</TableHead>{matrix.sections.map((section) => <TableHead key={section.id} className="min-w-44">{section.sectionName}</TableHead>)}</TableRow></TableHeader><TableBody>{projectedOfferings.map((offering) => <TableRow key={offering.id}><TableCell className="sticky left-0 z-10 bg-background font-medium"><div>{offering.subjectCode}</div><div className="text-xs text-muted-foreground">{offering.subjectDescription}</div></TableCell>{offering.cells.map((cell) => { const section = matrix.sections.find((item) => item.id === cell.sectionId); if (!section) return null; const item: Detail = { cell, offering, section }; const key = cellKey(offering.id, cell.sectionId); const visible = matchesMatrixCoverageFilter(cell, effectiveCoverageFilter); const termLabel = cell.termAssignments.map((term) => `${term.academicTermName}: ${term.teacher?.name ?? "Unassigned"}, ${termStatus(term)}`).join("; "); const label = `${offering.subjectCode}, ${section.sectionName}: ${termLabel}.`; return <TableCell key={cell.sectionId}>{visible && <div className="flex items-start gap-1">{selectionMode && <Checkbox aria-label={`Select ${offering.subjectCode} ${section.sectionName}`} checked={Boolean(selectedCells[key])} onCheckedChange={(checked) => toggleCell(item, checked === true)} />}<Button variant="ghost" className="h-auto w-full justify-start p-2 text-left" aria-label={label} onClick={() => { setDetail(item); setCopySource(item); }}><span className="space-y-1"><span className={cell.state === "UNASSIGNED" ? "block text-muted-foreground" : cell.state === "MIXED_BY_TERM" ? "block text-amber-700" : "block"}>{cell.state === "UNASSIGNED" ? "Unassigned" : cell.state === "MIXED_BY_TERM" ? "Mixed by Term" : cell.termAssignments[0]?.teacher?.name}</span><span className="flex flex-wrap gap-1">{cell.missingScopeCount > 0 && <Badge variant="outline">{cell.missingScopeCount} missing</Badge>}{cell.protectedScopeCount > 0 && <Badge variant="outline"><LockKeyhole />{cell.protectedScopeCount} protected</Badge>}{cell.startedUnassignedScopeCount > 0 && <Badge variant="secondary">Initial assignment allowed</Badge>}{termId && cell.termAssignments[0] && !cell.termAssignments[0].assignmentId && !cell.termAssignments[0].termHasStarted && <Badge variant="secondary">Assignable</Badge>}{termId && cell.termAssignments[0]?.assignmentId && !cell.termAssignments[0].protectedOwnership && <Badge variant="secondary">Editable</Badge>}</span></span></Button></div>}</TableCell>; })}</TableRow>)}{!visibleDetails.length && <TableRow><TableCell colSpan={matrix.sections.length + 1} className="p-8 text-center text-sm text-muted-foreground">No cells match this coverage filter.</TableCell></TableRow>}</TableBody></Table></div>}
    <div className="mt-6"><h2 className="mb-2 text-sm font-semibold">Teacher Load (informational)</h2><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Assignment scopes</TableHead><TableHead>Current Term scopes</TableHead><TableHead>Offerings</TableHead><TableHead>Sections</TableHead></TableRow></TableHeader><TableBody>{matrix.teacherLoads.map((load) => <TableRow key={load.teacherId}><TableCell>{load.employeeNumber ?? ""} {load.name}</TableCell><TableCell>{load.activeAssignmentScopeCount}</TableCell><TableCell>{load.currentTermAssignmentScopeCount}</TableCell><TableCell>{load.distinctOfferingCount}</TableCell><TableCell>{load.distinctSectionCount}</TableCell></TableRow>)}</TableBody></Table></div></div>
    <CellDialog key={detail ? `${cellKey(detail.offering.id, detail.section.id)}:${termId ?? "all"}` : "closed"} detail={detail} matrix={matrix} onClose={() => setDetail(null)} />
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>Review the exact requested assignment scopes. The command is all-or-nothing.</DialogDescription></DialogHeader><ScrollArea className="min-h-0 flex-1"><div className="space-y-2 pr-4 text-sm"><p className="font-medium">{preview?.scopeLabels.length ?? 0} exact assignment scope{preview?.scopeLabels.length === 1 ? "" : "s"}</p>{preview?.scopeLabels.map((label) => <div key={label} className="rounded-md border p-2">{label}</div>)}</div></ScrollArea><DialogFooter className="shrink-0"><Button type="button" variant="outline" onClick={() => setPreview(null)}>Cancel</Button><Button type="button" disabled={mutation.isPending} onClick={() => void confirmPreview()}>{mutation.isPending ? "Applying..." : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
