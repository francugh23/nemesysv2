"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { getAssignmentMatrixAction } from "@/actions/subject-assignment.action";

type Matrix = Awaited<ReturnType<typeof getAssignmentMatrixAction>>;
type Cell = Matrix["offerings"][number]["cells"][number];

function CellDetail({ cell, offering, section, onClose }: { cell: Cell | null; offering: string; section: string; onClose: () => void }) {
  return <Dialog open={Boolean(cell)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>{offering} / {section}</DialogTitle><DialogDescription>Exact Term teaching ownership. Assignment changes are available in Phase 23-C2.</DialogDescription></DialogHeader><ScrollArea className="min-h-0 flex-1"><div className="space-y-3 pr-4">{cell?.termAssignments.map((term) => <div key={term.academicTermId} className="rounded-md border p-3 text-sm"><div className="font-medium">{term.academicTermName}</div><div>{term.teacher ? `${term.teacher.employeeNumber ?? ""} ${term.teacher.name}` : "Unassigned"}</div><div className="text-muted-foreground">{term.protectedOwnership ? "Started-Term ownership protected" : term.initialAssignmentAllowed ? "Initial assignment allowed" : "Ownership editable"}</div></div>)}</div></ScrollArea></DialogContent></Dialog>;
}

export function AssignmentMatrix({ matrix }: { matrix: Matrix }) {
  const [detail, setDetail] = useState<{ cell: Cell; offering: string; section: string } | null>(null);
  return <>
    <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6"><div className="rounded-md border p-3">Expected scopes: {matrix.coverage.expectedScopes}</div><div className="rounded-md border p-3">Assigned: {matrix.coverage.assignedScopes}</div><div className="rounded-md border p-3">Missing: {matrix.coverage.missingScopes}</div><div className="rounded-md border p-3">Complete cells: {matrix.coverage.fullyCoveredCells}</div><div className="rounded-md border p-3">Mixed cells: {matrix.coverage.mixedCells}</div><div className="rounded-md border p-3">Protected scopes: {matrix.coverage.protectedScopes}</div></div>
    {!matrix.offerings.length || !matrix.sections.length ? <div className="mt-4 rounded-md border p-8 text-center text-sm text-muted-foreground">No eligible Curriculum Offerings or organizational Sections exist for Grade {matrix.gradeLevel}.</div> : <div className="mt-4 overflow-x-auto rounded-md border"><Table className="min-w-max"><TableHeader><TableRow><TableHead className="sticky left-0 z-10 bg-background">Offering</TableHead>{matrix.sections.map((section) => <TableHead key={section.id} className="min-w-44">{section.sectionName}</TableHead>)}</TableRow></TableHeader><TableBody>{matrix.offerings.map((offering) => <TableRow key={offering.id}><TableCell className="sticky left-0 z-10 bg-background font-medium"><div>{offering.subjectCode}</div><div className="text-xs text-muted-foreground">{offering.subjectDescription}</div></TableCell>{offering.cells.map((cell, index) => <TableCell key={cell.sectionId}><Button variant="ghost" className="h-auto w-full justify-start p-2 text-left" onClick={() => setDetail({ cell, offering: `${offering.subjectCode} - ${offering.subjectDescription}`, section: matrix.sections[index].sectionName })}><span className={cell.state === "UNASSIGNED" ? "text-muted-foreground" : cell.state === "MIXED_BY_TERM" ? "text-amber-700" : ""}>{cell.state === "UNASSIGNED" ? "Unassigned" : cell.state === "MIXED_BY_TERM" ? "Mixed by Term" : cell.termAssignments[0].teacher?.name}</span></Button></TableCell>)}</TableRow>)}</TableBody></Table></div>}
    <div className="mt-6"><h2 className="mb-2 text-sm font-semibold">Teacher Load (informational)</h2><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Assignment scopes</TableHead><TableHead>Current Term scopes</TableHead><TableHead>Offerings</TableHead><TableHead>Sections</TableHead></TableRow></TableHeader><TableBody>{matrix.teacherLoads.map((load) => <TableRow key={load.teacherId}><TableCell>{load.employeeNumber ?? ""} {load.name}</TableCell><TableCell>{load.activeAssignmentScopeCount}</TableCell><TableCell>{load.currentTermAssignmentScopeCount}</TableCell><TableCell>{load.distinctOfferingCount}</TableCell><TableCell>{load.distinctSectionCount}</TableCell></TableRow>)}</TableBody></Table></div></div>
    <CellDetail cell={detail?.cell ?? null} offering={detail?.offering ?? ""} section={detail?.section ?? ""} onClose={() => setDetail(null)} />
  </>;
}
