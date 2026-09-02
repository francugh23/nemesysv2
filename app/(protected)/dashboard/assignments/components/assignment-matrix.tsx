"use client";

import { useState } from "react";

import type { getAssignmentMatrixAction } from "@/actions/subject-assignment.action";
import type { AssignmentMatrixMutation } from "@/schemas";
import { useMutateAssignmentMatrix, useSubjectAssignmentOptions } from "@/hooks/subject-assignment.hook";
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

function CellDialog({ detail, matrix, onClose }: { detail: Detail | null; matrix: Matrix; onClose: () => void }) {
  const [teacherId, setTeacherId] = useState("");
  const [selectedTerms, setSelectedTerms] = useState<string[]>(() => detail?.cell.termAssignments.filter((term) => term.initialAssignmentAllowed).map((term) => term.academicTermId) ?? []);
  const [error, setError] = useState<string | null>(null);
  const options = useSubjectAssignmentOptions();
  const mutation = useMutateAssignmentMatrix();
  const editableTerms = detail?.cell.termAssignments.filter((term) => term.initialAssignmentAllowed || term.ownershipEditable) ?? [];

  function toggleTerm(termId: string, checked: boolean) {
    setSelectedTerms((current) => checked ? [...new Set([...current, termId])] : current.filter((id) => id !== termId));
  }

  async function assign() {
    if (!detail || !teacherId || !selectedTerms.length) return;
    setError(null);
    const result = await mutation.mutateAsync({
      action: "ASSIGN",
      academicYearId: matrix.academicYear.id,
      gradeLevel: matrix.gradeLevel,
      teacherId,
      scopes: detail.cell.termAssignments.filter((term) => selectedTerms.includes(term.academicTermId)).map((term) => termScope(detail, term)),
    });
    if (result.error) setError(result.error);
    else onClose();
  }

  async function clear() {
    if (!detail) return;
    const scopes = detail.cell.termAssignments.filter((term) => selectedTerms.includes(term.academicTermId) && term.assignmentId).map((term) => termScope(detail, term));
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

  return (
    <Dialog open={Boolean(detail)} onOpenChange={onOpenChange}>
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
                <span className="space-y-1"><span className="block font-medium">{term.academicTermName}</span><span className="block">{term.teacher ? `${term.teacher.employeeNumber ?? ""} ${term.teacher.name}` : "Unassigned"}</span><span className="block text-muted-foreground">{term.protectedOwnership ? "Assigned - protected" : term.initialAssignmentAllowed ? "Unassigned - initial assignment allowed" : "Assigned - editable"}</span></span>
              </label>;
            })}
            {!editableTerms.length && <p className="text-sm text-muted-foreground">Every applicable Term is protected.</p>}
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="matrix-teacher">Teacher</label><Select value={teacherId} onValueChange={(value) => setTeacherId(value ?? "")}><SelectTrigger id="matrix-teacher"><SelectValue placeholder="Select active Teacher" /></SelectTrigger><SelectContent>{options.data?.teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.employeeNumber ? `${teacher.employeeNumber} - ` : ""}{teacher.lastName}, {teacher.firstName}</SelectItem>)}</SelectContent></Select></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </ScrollArea>
        <DialogFooter className="shrink-0"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" variant="outline" disabled={!selectedTerms.length || mutation.isPending} onClick={() => void clear()}>Clear selected Terms</Button><Button type="button" disabled={!teacherId || !selectedTerms.length || mutation.isPending} onClick={() => void assign()}>{mutation.isPending ? "Applying..." : "Assign selected Terms"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignmentMatrix({ matrix }: { matrix: Matrix }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Record<string, Detail>>({});
  const [bulkTeacherId, setBulkTeacherId] = useState("");
  const [copySource, setCopySource] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ value: AssignmentMatrixMutation; title: string; scopeLabels: string[] } | null>(null);
  const options = useSubjectAssignmentOptions();
  const mutation = useMutateAssignmentMatrix();
  const selected = Object.values(selectedCells);

  function toggleCell(detail: Detail, checked: boolean) {
    const key = cellKey(detail.offering.id, detail.section.id);
    setSelectedCells((current) => {
      if (!checked) { const remaining = { ...current }; delete remaining[key]; return remaining; }
      return { ...current, [key]: detail };
    });
  }

  function fillSelected() {
    if (!bulkTeacherId || !selected.length) return;
    const scopes = selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.initialAssignmentAllowed || term.ownershipEditable).map((term) => termScope(item, term)));
    setPreview({ value: { action: "ASSIGN", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, teacherId: bulkTeacherId, scopes }, title: "Fill selected cells", scopeLabels: selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.initialAssignmentAllowed || term.ownershipEditable).map((term) => `${item.section.sectionName} / ${term.academicTermName}`)) });
  }

  function clearSelected() {
    const scopes = selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.assignmentId && term.ownershipEditable).map((term) => termScope(item, term)));
    if (!scopes.length) return;
    setPreview({ value: { action: "CLEAR", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, scopes }, title: "Clear selected future scopes", scopeLabels: selected.flatMap((item) => item.cell.termAssignments.filter((term) => term.assignmentId && term.ownershipEditable).map((term) => `${item.section.sectionName} / ${term.academicTermName}`)) });
  }

  function copyToSelected() {
    if (!copySource) return;
    const destinations = selected.filter((item) => item.offering.id === copySource.offering.id && item.section.id !== copySource.section.id);
    const sourceScopes = copySource.cell.termAssignments.filter((term) => term.assignmentId).map((term) => termScope(copySource, term));
    const destinationScopes = destinations.flatMap((item) => item.cell.termAssignments.filter((term) => sourceScopes.some((source) => source.academicTermId === term.academicTermId)).map((term) => termScope(item, term)));
    if (!sourceScopes.length || !destinationScopes.length) { setError("Select destination cells for this Offering and a source cell with assignments."); return; }
    setPreview({ value: { action: "COPY", academicYearId: matrix.academicYear.id, gradeLevel: matrix.gradeLevel, sourceScopes, destinationScopes }, title: "Copy teaching ownership", scopeLabels: destinations.flatMap((item) => item.cell.termAssignments.filter((term) => sourceScopes.some((source) => source.academicTermId === term.academicTermId)).map((term) => `${item.section.sectionName} / ${term.academicTermName}`)) });
  }

  async function confirmPreview() {
    if (!preview) return;
    setError(null);
    const result = await mutation.mutateAsync(preview.value);
    if (result.error) setError(result.error);
    else { setSelectedCells({}); setCopySource(null); setPreview(null); }
  }

  return <>
    <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6"><div className="rounded-md border p-3">Expected scopes: {matrix.coverage.expectedScopes}</div><div className="rounded-md border p-3">Assigned: {matrix.coverage.assignedScopes}</div><div className="rounded-md border p-3">Missing: {matrix.coverage.missingScopes}</div><div className="rounded-md border p-3">Complete cells: {matrix.coverage.fullyCoveredCells}</div><div className="rounded-md border p-3">Mixed cells: {matrix.coverage.mixedCells}</div><div className="rounded-md border p-3">Protected scopes: {matrix.coverage.protectedScopes}</div></div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><Button type="button" variant={selectionMode ? "secondary" : "outline"} onClick={() => setSelectionMode((current) => !current)}>Select cells</Button>{selectionMode && <><Select value={bulkTeacherId} onValueChange={(value) => setBulkTeacherId(value ?? "")}><SelectTrigger aria-label="Teacher for selected cells"><SelectValue placeholder="Active Teacher" /></SelectTrigger><SelectContent>{options.data?.teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.employeeNumber ? `${teacher.employeeNumber} - ` : ""}{teacher.lastName}, {teacher.firstName}</SelectItem>)}</SelectContent></Select><Button type="button" disabled={!bulkTeacherId || !selected.length || mutation.isPending} onClick={() => void fillSelected()}>Fill selected</Button><Button type="button" variant="outline" disabled={!selected.length || mutation.isPending} onClick={() => void clearSelected()}>Clear selected future scopes</Button><Button type="button" variant="outline" disabled={!copySource || !selected.length || mutation.isPending} onClick={() => void copyToSelected()}>Copy to selected Sections</Button><span className="text-sm text-muted-foreground">{selected.length} cell{selected.length === 1 ? "" : "s"} selected</span></>}{error && <span className="text-sm text-destructive">{error}</span>}</div>
    {!matrix.offerings.length || !matrix.sections.length ? <div className="mt-4 rounded-md border p-8 text-center text-sm text-muted-foreground">No eligible Curriculum Offerings or organizational Sections exist for Grade {matrix.gradeLevel}.</div> : <div className="mt-4 overflow-x-auto rounded-md border"><Table className="min-w-max"><TableHeader><TableRow><TableHead className="sticky left-0 z-10 bg-background">Offering</TableHead>{matrix.sections.map((section) => <TableHead key={section.id} className="min-w-44">{section.sectionName}</TableHead>)}</TableRow></TableHeader><TableBody>{matrix.offerings.map((offering) => <TableRow key={offering.id}><TableCell className="sticky left-0 z-10 bg-background font-medium"><div>{offering.subjectCode}</div><div className="text-xs text-muted-foreground">{offering.subjectDescription}</div></TableCell>{offering.cells.map((cell, index) => { const item = { cell, offering, section: matrix.sections[index] }; const key = cellKey(offering.id, cell.sectionId); return <TableCell key={cell.sectionId}><div className="flex items-start gap-1">{selectionMode && <Checkbox aria-label={`Select ${offering.subjectCode} ${item.section.sectionName}`} checked={Boolean(selectedCells[key])} onCheckedChange={(checked) => toggleCell(item, checked === true)} />}<Button variant="ghost" className="h-auto w-full justify-start p-2 text-left" onClick={() => { setDetail(item); setCopySource(item); }}><span className={cell.state === "UNASSIGNED" ? "text-muted-foreground" : cell.state === "MIXED_BY_TERM" ? "text-amber-700" : ""}>{cell.state === "UNASSIGNED" ? "Unassigned" : cell.state === "MIXED_BY_TERM" ? "Mixed by Term" : cell.termAssignments[0].teacher?.name}</span></Button></div></TableCell>; })}</TableRow>)}</TableBody></Table></div>}
    <div className="mt-6"><h2 className="mb-2 text-sm font-semibold">Teacher Load (informational)</h2><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Assignment scopes</TableHead><TableHead>Current Term scopes</TableHead><TableHead>Offerings</TableHead><TableHead>Sections</TableHead></TableRow></TableHeader><TableBody>{matrix.teacherLoads.map((load) => <TableRow key={load.teacherId}><TableCell>{load.employeeNumber ?? ""} {load.name}</TableCell><TableCell>{load.activeAssignmentScopeCount}</TableCell><TableCell>{load.currentTermAssignmentScopeCount}</TableCell><TableCell>{load.distinctOfferingCount}</TableCell><TableCell>{load.distinctSectionCount}</TableCell></TableRow>)}</TableBody></Table></div></div>
    <CellDialog key={detail ? cellKey(detail.offering.id, detail.section.id) : "closed"} detail={detail} matrix={matrix} onClose={() => setDetail(null)} />
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>Review the exact requested assignment scopes. The command is all-or-nothing.</DialogDescription></DialogHeader><ScrollArea className="min-h-0 flex-1"><div className="space-y-2 pr-4 text-sm"><p className="font-medium">{preview?.scopeLabels.length ?? 0} exact assignment scope{preview?.scopeLabels.length === 1 ? "" : "s"}</p>{preview?.scopeLabels.map((label) => <div key={label} className="rounded-md border p-2">{label}</div>)}</div></ScrollArea><DialogFooter className="shrink-0"><Button type="button" variant="outline" onClick={() => setPreview(null)}>Cancel</Button><Button type="button" disabled={mutation.isPending} onClick={() => void confirmPreview()}>{mutation.isPending ? "Applying..." : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
