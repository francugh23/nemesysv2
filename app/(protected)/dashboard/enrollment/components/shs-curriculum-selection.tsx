"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEligibleShsOfferingsForEnrollment, useSelectShsStudentCurriculum, useStudentSubjectEnrollments } from "@/hooks/student-subject-enrollment.hook";

export function ShsCurriculumSelection({ enrollmentId, gradeLevel, open }: { enrollmentId: string; gradeLevel: string; open: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: rows } = useStudentSubjectEnrollments(enrollmentId, open);
  const activeIds = rows?.filter((row) => row.status === "ACTIVE").map((row) => row.subjectOfferingId) ?? [];
  if (gradeLevel !== "11" && gradeLevel !== "12") return null;
  return <section className="rounded-lg border bg-muted/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">SSHS Curriculum Selection</h3><p className="text-sm text-muted-foreground">Only school-approved offerings can be explicitly selected. DepEd provisional references are not available to students.</p></div><Button size="sm" onClick={() => setDialogOpen(true)}>Select approved offerings</Button></div><p className="mt-3 text-sm text-muted-foreground">{activeIds.length} active selection{activeIds.length === 1 ? "" : "s"}.</p>{dialogOpen && <ShsCurriculumSelectionDialog enrollmentId={enrollmentId} open onOpenChange={setDialogOpen} initialIds={activeIds} />}</section>;
}

function ShsCurriculumSelectionDialog({ enrollmentId, open, onOpenChange, initialIds }: { enrollmentId: string; open: boolean; onOpenChange: (open: boolean) => void; initialIds: string[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const eligible = useEligibleShsOfferingsForEnrollment(enrollmentId, open);
  const selection = useSelectShsStudentCurriculum(enrollmentId);
  const toggle = (id: string, checked: boolean) => setSelectedIds((current) => checked ? [...current, id] : current.filter((value) => value !== id));
  const submit = async () => { const result = await selection.mutateAsync({ enrollmentId, subjectOfferingIds: selectedIds }); if (!result.error) onOpenChange(false); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Select School-Approved SSHS Offerings</DialogTitle><DialogDescription>Selections replace only prior SSHS selections that are no longer checked. Historical records remain visible.</DialogDescription></DialogHeader>{eligible.isLoading ? <div className="space-y-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : eligible.isError ? <div className="rounded-lg border p-4 text-sm"><p className="font-medium">Unable to load approved SSHS offerings.</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void eligible.refetch()}>Try again</Button></div> : eligible.data?.length ? <div className="space-y-2">{eligible.data.map((offering) => { const checked = selectedIds.includes(offering.id); return <label key={offering.id} className="flex cursor-pointer gap-3 rounded-lg border p-3"><Checkbox checked={checked} onCheckedChange={(value) => toggle(offering.id, value === true)} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono font-medium">{offering.subjectCode}</span><Badge>{offering.shsContext?.curriculumStatus}</Badge><Badge variant="outline">{offering.shsContext?.classification}</Badge></div><p className="mt-1">{offering.subjectDescription}</p><p className="mt-1 text-xs text-muted-foreground">{offering.shsContext?.cluster ? `${offering.shsContext.cluster.code} | ${offering.shsContext.cluster.name}` : "Core subject"}</p><div className="mt-2 flex flex-wrap gap-1">{offering.terms.map((term) => <Badge key={term.academicTermId} variant="secondary">{term.academicTerm.position}. {term.academicTerm.name}</Badge>)}</div></div></label>; })}</div> : <div className="rounded-lg border p-4 text-sm text-muted-foreground">No school-approved SSHS offerings are enabled for this enrollment’s academic year and grade.</div>}{selection.data?.error && <p className="text-sm text-destructive">{selection.data.error}</p>}<DialogFooter showCloseButton><Button onClick={() => void submit()} disabled={selection.isPending || eligible.isLoading}>{selection.isPending ? "Saving..." : "Save selection"}</Button></DialogFooter></DialogContent></Dialog>;
}
