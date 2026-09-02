"use client";

import { useEffect, useRef, useState } from "react";

import type { getAssignmentMatrixAction } from "@/actions/subject-assignment.action";
import type { AssignmentMatrixMutation } from "@/schemas";
import {
  groupMissingMatrixScopes,
  matchesMatrixCoverageFilter,
  matchesMatrixTeacherFocus,
  matchingTeacherTerms,
  projectMatrixCell,
  summarizeProjectedCells,
  type MatrixCoverageFilter,
  type MatrixTeacherFocus,
} from "@/lib/assignment-matrix-projection";
import {
  useMutateAssignmentMatrix,
  useSubjectAssignmentOptions,
} from "@/hooks/subject-assignment.hook";
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
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
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

type Matrix = Awaited<ReturnType<typeof getAssignmentMatrixAction>>;
type Offering = Matrix["offerings"][number];
type Cell = Offering["cells"][number];
type ProjectedCell = Cell &
  ReturnType<typeof projectMatrixCell<Cell["termAssignments"][number]>>;
type Detail = {
  cell: ProjectedCell;
  offering: Offering;
  section: Matrix["sections"][number];
};
type MissingGroup = ReturnType<typeof groupMissingMatrixScopes>[number];

const cellKey = (offeringId: string, sectionId: string) =>
  `${offeringId}:${sectionId}`;

function teacherLabel(teacher: {
  employeeNumber: string | null;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  name?: string;
}) {
  const name =
    teacher.name ??
    [teacher.lastName, teacher.firstName, teacher.middleName]
      .filter(Boolean)
      .join(", ");
  return teacher.employeeNumber ? `${teacher.employeeNumber} - ${name}` : name;
}

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

function CellDialog({
  detail,
  matrix,
  onClose,
}: {
  detail: Detail | null;
  matrix: Matrix;
  onClose: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [selectedTerms, setSelectedTerms] = useState<string[]>(
    () =>
      detail?.cell.termAssignments
        .filter((term) => term.initialAssignmentAllowed)
        .map((term) => term.academicTermId) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const options = useSubjectAssignmentOptions();
  const mutation = useMutateAssignmentMatrix();
  const selectedTeacher = options.data?.teachers.find(
    (teacher) => teacher.id === teacherId,
  );
  const editableTerms =
    detail?.cell.termAssignments.filter(
      (term) => term.initialAssignmentAllowed || term.ownershipEditable,
    ) ?? [];
  const clearableTerms =
    detail?.cell.termAssignments.filter(
      (term) => term.assignmentId && term.ownershipEditable,
    ) ?? [];

  function toggleTerm(termId: string, checked: boolean) {
    setSelectedTerms((current) =>
      checked
        ? [...new Set([...current, termId])]
        : current.filter((id) => id !== termId),
    );
  }

  async function assign() {
    if (!detail || !teacherId || !selectedTerms.length) return;
    setError(null);
    const result = await mutation.mutateAsync({
      action: "ASSIGN",
      academicYearId: matrix.academicYear.id,
      gradeLevel: matrix.gradeLevel,
      teacherId,
      scopes: detail.cell.termAssignments
        .filter((term) => selectedTerms.includes(term.academicTermId))
        .map((term) => termScope(detail, term)),
    });
    if (result.error) setError(result.error);
    else onClose();
  }

  async function clear() {
    if (!detail) return;
    const scopes = clearableTerms
      .filter((term) => selectedTerms.includes(term.academicTermId))
      .map((term) => termScope(detail, term));
    if (!scopes.length) return;
    setError(null);
    const result = await mutation.mutateAsync({
      action: "CLEAR",
      academicYearId: matrix.academicYear.id,
      gradeLevel: matrix.gradeLevel,
      scopes,
    });
    if (result.error) setError(result.error);
    else onClose();
  }

  return (
    <Dialog
      open={Boolean(detail)}
      onOpenChange={(open) => {
        if (!open) {
          setTeacherId("");
          setSelectedTerms([]);
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {detail
              ? `${detail.offering.subjectCode} / ${detail.section.sectionName}`
              : "Teaching assignment"}
          </DialogTitle>
          <DialogDescription>
            Choose exact editable Terms. Started assigned ownership is
            protected; unassigned started Terms permit an initial assignment.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 pr-4">
            {detail?.cell.termAssignments.map((term) => {
              const editable =
                term.initialAssignmentAllowed || term.ownershipEditable;
              return (
                <label
                  key={term.academicTermId}
                  className="flex gap-3 rounded-md border p-3 text-sm"
                >
                  <Checkbox
                    checked={selectedTerms.includes(term.academicTermId)}
                    disabled={!editable}
                    onCheckedChange={(checked) =>
                      toggleTerm(term.academicTermId, checked === true)
                    }
                  />
                  <span className="space-y-1">
                    <span className="block font-medium">
                      {term.academicTermName}
                    </span>
                    <span className="block">
                      {term.teacher
                        ? `${term.teacher.employeeNumber ?? ""} ${term.teacher.name}`
                        : "Unassigned"}
                    </span>
                    <span className="block text-muted-foreground">
                      {termStatus(term)}
                    </span>
                  </span>
                </label>
              );
            })}
            {!editableTerms.length && (
              <p className="text-sm text-muted-foreground">
                Every displayed Term is protected.
              </p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="matrix-teacher">
                Teacher
              </label>
              <Select
                value={teacherId}
                onValueChange={(value) => setTeacherId(value ?? "")}
              >
                <SelectTrigger id="matrix-teacher" className="w-full min-w-64">
                  <SelectValue>
                    {selectedTeacher
                      ? teacherLabel(selectedTeacher)
                      : "Select active Teacher"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {options.data?.teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacherLabel(teacher)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </ScrollArea>
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              !clearableTerms.some((term) =>
                selectedTerms.includes(term.academicTermId),
              ) || mutation.isPending
            }
            onClick={() => void clear()}
          >
            Clear selected Terms
          </Button>
          <Button
            type="button"
            disabled={!teacherId || !selectedTerms.length || mutation.isPending}
            onClick={() => void assign()}
          >
            {mutation.isPending ? "Applying..." : "Assign selected Terms"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MissingCoverageDialog({
  group,
  onClose,
}: {
  group: MissingGroup | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(group)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {group
              ? `Missing coverage: ${group.offeringCode}`
              : "Missing coverage"}
          </DialogTitle>
          <DialogDescription>
            {group?.offeringDescription}. Exact unassigned assignment scopes are
            read-only here.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offering</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Assignment eligibility</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group?.scopes.map((scope) => (
                  <TableRow key={`${scope.sectionId}:${scope.academicTermId}`}>
                    <TableCell>{scope.offeringCode}</TableCell>
                    <TableCell>{scope.sectionName}</TableCell>
                    <TableCell>{scope.academicTermName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {scope.termHasStarted ? "Started" : "Future"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {scope.initialAssignmentAllowed
                        ? "Initial assignment allowed"
                        : "Assignable"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
        <DialogFooter className="shrink-0">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignmentMatrix({
  matrix,
  termId,
}: {
  matrix: Matrix;
  termId: string | null;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Record<string, Detail>>(
    {},
  );
  const [bulkTeacherId, setBulkTeacherId] = useState("");
  const [copySource, setCopySource] = useState<Detail | null>(null);
  const [coverageFilter, setCoverageFilter] =
    useState<MatrixCoverageFilter>("ALL");
  const [teacherFocus, setTeacherFocus] = useState<MatrixTeacherFocus>("ALL");
  const [showLoads, setShowLoads] = useState(false);
  const [missingGroup, setMissingGroup] = useState<MissingGroup | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    value: AssignmentMatrixMutation;
    title: string;
    scopeLabels: string[];
  } | null>(null);
  const options = useSubjectAssignmentOptions();
  const mutation = useMutateAssignmentMatrix();
  const previousContext = useRef<{
    gradeLevel: string;
    termId: string | null;
    coverageFilter: MatrixCoverageFilter;
    teacherFocus: MatrixTeacherFocus;
  } | null>(null);
  const effectiveCoverageFilter =
    termId && coverageFilter === "MIXED_BY_TERM" ? "ALL" : coverageFilter;
  const teacherOptions: SearchableSelectOption[] = [
    { value: "ALL", label: "All Teachers" },
    { value: "UNASSIGNED", label: "Unassigned" },
    ...(options.data?.teachers.map((teacher) => ({
      value: teacher.id,
      label: teacherLabel(teacher),
      searchValue: `${teacher.employeeNumber ?? ""} ${teacher.firstName} ${teacher.middleName ?? ""} ${teacher.lastName}`,
    })) ?? []),
  ];
  const selectedTeacher = options.data?.teachers.find(
    (teacher) => teacher.id === teacherFocus,
  );
  const bulkTeacher = options.data?.teachers.find(
    (teacher) => teacher.id === bulkTeacherId,
  );

  useEffect(() => {
    const context = {
      gradeLevel: matrix.gradeLevel,
      termId,
      coverageFilter: effectiveCoverageFilter,
      teacherFocus,
    };
    const previous = previousContext.current;
    previousContext.current = context;
    if (
      !previous ||
      (previous.gradeLevel === context.gradeLevel &&
        previous.termId === context.termId &&
        previous.coverageFilter === context.coverageFilter &&
        previous.teacherFocus === context.teacherFocus)
    )
      return;
    const reason =
      previous.gradeLevel !== context.gradeLevel
        ? "Grade"
        : previous.termId !== context.termId
          ? "Term view"
          : previous.coverageFilter !== context.coverageFilter
            ? "coverage filter"
            : "Teacher focus";
    const selectedCount = Object.keys(selectedCells).length;
    setSelectedCells({});
    setCopySource(null);
    setDetail(null);
    setAnnouncement(
      `${selectedCount ? `${selectedCount} selected cell${selectedCount === 1 ? "" : "s"} cleared` : "Selection cleared"} because the ${reason} changed.`,
    );
  }, [
    effectiveCoverageFilter,
    matrix.gradeLevel,
    selectedCells,
    teacherFocus,
    termId,
  ]);

  const projectedOfferings = matrix.offerings
    .map((offering) => ({
      ...offering,
      cells: offering.cells
        .map((cell) => ({ ...cell, ...projectMatrixCell(cell, termId) }))
        .filter((cell) => cell.termAssignments.length > 0),
    }))
    .filter((offering) => offering.cells.length > 0);
  const projectedCells = projectedOfferings.flatMap(
    (offering) => offering.cells,
  );
  const coverage = summarizeProjectedCells(projectedCells);
  const details = projectedOfferings.flatMap((offering) =>
    offering.cells
      .map((cell) => {
        const section = matrix.sections.find(
          (item) => item.id === cell.sectionId,
        );
        return section ? { cell, offering, section } : null;
      })
      .filter(Boolean),
  ) as Detail[];
  const visibleDetails = details.filter(
    (item) =>
      matchesMatrixTeacherFocus(item.cell, teacherFocus) &&
      matchesMatrixCoverageFilter(item.cell, effectiveCoverageFilter),
  );
  const visibleKeys = new Set(
    visibleDetails.map((item) => cellKey(item.offering.id, item.section.id)),
  );
  const selected = Object.values(selectedCells).filter((item) =>
    visibleKeys.has(cellKey(item.offering.id, item.section.id)),
  );
  const actionableScopeCount = selected
    .flatMap((item) => item.cell.termAssignments)
    .filter(
      (term) => term.initialAssignmentAllowed || term.ownershipEditable,
    ).length;
  const missingGroups = groupMissingMatrixScopes(
    details
      .filter((item) => matchesMatrixTeacherFocus(item.cell, teacherFocus))
      .flatMap((item) =>
        item.cell.termAssignments
          .filter((term) => !term.assignmentId)
          .map((term) => ({
            offeringId: item.offering.id,
            offeringCode: item.offering.subjectCode,
            offeringDescription: item.offering.subjectDescription,
            sectionId: item.section.id,
            sectionName: item.section.sectionName,
            academicTermId: term.academicTermId,
            academicTermName: term.academicTermName,
            termHasStarted: term.termHasStarted,
            initialAssignmentAllowed: term.initialAssignmentAllowed,
          })),
      ),
  );
  const selectedTerm = matrix.terms.find((term) => term.id === termId);
  const loadRows =
    teacherFocus !== "ALL" && teacherFocus !== "UNASSIGNED" && selectedTeacher
      ? [
          {
            teacherId: selectedTeacher.id,
            employeeNumber: selectedTeacher.employeeNumber,
            name: `${selectedTeacher.lastName}, ${selectedTeacher.firstName}`,
            activeAssignmentScopeCount: 0,
            distinctOfferingCount: 0,
            distinctSectionCount: 0,
            termLoads: [],
            ...(matrix.teacherLoads.find(
              (load) => load.teacherId === teacherFocus,
            ) ?? {}),
          },
        ]
      : matrix.teacherLoads;

  function toggleCell(item: Detail, checked: boolean) {
    const key = cellKey(item.offering.id, item.section.id);
    setSelectedCells((current) => {
      if (!checked) {
        const remaining = { ...current };
        delete remaining[key];
        return remaining;
      }
      return { ...current, [key]: item };
    });
  }
  function selectAllVisible() {
    const scopes = visibleDetails
      .flatMap((item) => item.cell.termAssignments)
      .filter(
        (term) => term.initialAssignmentAllowed || term.ownershipEditable,
      ).length;
    setSelectedCells(
      Object.fromEntries(
        visibleDetails.map((item) => [
          cellKey(item.offering.id, item.section.id),
          item,
        ]),
      ),
    );
    setAnnouncement(
      `${visibleDetails.length} visible cell${visibleDetails.length === 1 ? "" : "s"} selected, ${scopes} actionable assignment scope${scopes === 1 ? "" : "s"}.`,
    );
  }
  function clearSelection() {
    setSelectedCells({});
    setCopySource(null);
    setAnnouncement("Selection and copy source cleared.");
  }
  function fillSelected() {
    if (!bulkTeacherId || !selected.length) return;
    const scopes = selected.flatMap((item) =>
      item.cell.termAssignments
        .filter(
          (term) => term.initialAssignmentAllowed || term.ownershipEditable,
        )
        .map((term) => termScope(item, term)),
    );
    if (scopes.length)
      setPreview({
        value: {
          action: "ASSIGN",
          academicYearId: matrix.academicYear.id,
          gradeLevel: matrix.gradeLevel,
          teacherId: bulkTeacherId,
          scopes,
        },
        title: "Fill selected cells",
        scopeLabels: selected.flatMap((item) =>
          item.cell.termAssignments
            .filter(
              (term) => term.initialAssignmentAllowed || term.ownershipEditable,
            )
            .map(
              (term) =>
                `${item.offering.subjectCode} / ${item.section.sectionName} / ${term.academicTermName}`,
            ),
        ),
      });
  }
  function clearSelected() {
    const scopes = selected.flatMap((item) =>
      item.cell.termAssignments
        .filter((term) => term.assignmentId && term.ownershipEditable)
        .map((term) => termScope(item, term)),
    );
    if (scopes.length)
      setPreview({
        value: {
          action: "CLEAR",
          academicYearId: matrix.academicYear.id,
          gradeLevel: matrix.gradeLevel,
          scopes,
        },
        title: "Clear selected future scopes",
        scopeLabels: selected.flatMap((item) =>
          item.cell.termAssignments
            .filter((term) => term.assignmentId && term.ownershipEditable)
            .map(
              (term) =>
                `${item.offering.subjectCode} / ${item.section.sectionName} / ${term.academicTermName}`,
            ),
        ),
      });
  }
  function copyToSelected() {
    if (!copySource) return;
    const destinations = selected.filter(
      (item) =>
        item.offering.id === copySource.offering.id &&
        item.section.id !== copySource.section.id,
    );
    const sourceScopes = copySource.cell.termAssignments
      .filter((term) => term.assignmentId)
      .map((term) => termScope(copySource, term));
    const destinationScopes = destinations.flatMap((item) =>
      item.cell.termAssignments
        .filter(
          (term) =>
            (term.initialAssignmentAllowed || term.ownershipEditable) &&
            sourceScopes.some(
              (source) => source.academicTermId === term.academicTermId,
            ),
        )
        .map((term) => termScope(item, term)),
    );
    if (!sourceScopes.length || !destinationScopes.length) {
      setError(
        "Select editable destination cells for this Offering and a source cell with assignments.",
      );
      return;
    }
    setPreview({
      value: {
        action: "COPY",
        academicYearId: matrix.academicYear.id,
        gradeLevel: matrix.gradeLevel,
        sourceScopes,
        destinationScopes,
      },
      title: "Copy teaching ownership",
      scopeLabels: destinations.flatMap((item) =>
        item.cell.termAssignments
          .filter(
            (term) =>
              (term.initialAssignmentAllowed || term.ownershipEditable) &&
              sourceScopes.some(
                (source) => source.academicTermId === term.academicTermId,
              ),
          )
          .map(
            (term) =>
              `${item.offering.subjectCode} / ${item.section.sectionName} / ${term.academicTermName}`,
          ),
      ),
    });
  }
  async function confirmPreview() {
    if (!preview) return;
    setError(null);
    const result = await mutation.mutateAsync(preview.value);
    if (result.error) setError(result.error);
    else {
      setSelectedCells({});
      setCopySource(null);
      setPreview(null);
      setAnnouncement(
        "Teaching assignment changes applied. Selection cleared.",
      );
    }
  }

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div aria-live="polite" className="sr-only">
        {selected.length} selected cells, {actionableScopeCount} actionable
        assignment scopes.
      </div>
      <section aria-labelledby="coverage-summary" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="coverage-summary" className="font-semibold">
            Coverage summary
          </h2>
          <span className="text-sm text-muted-foreground">
            {coverage.assignedScopes} of {coverage.expectedScopes} assignment
            scopes assigned
          </span>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            [
              "Coverage",
              coverage.coveragePercent === null
                ? "Not applicable"
                : `${coverage.coveragePercent.toFixed(1)}%`,
            ],
            ["Missing", coverage.missingScopes],
            ["Assigned", coverage.assignedScopes],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-md border p-3">
              <div className="text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold">{value}</div>
            </div>
          ))}
          {coverage.protectedScopes > 0 && (
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Protected</div>
              <div className="text-lg font-semibold">
                {coverage.protectedScopes}
              </div>
            </div>
          )}
          {coverage.startedUnassignedScopes > 0 && (
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Started unassigned</div>
              <div className="text-lg font-semibold">
                {coverage.startedUnassignedScopes}
              </div>
            </div>
          )}
        </div>
      </section>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label
            className="text-sm font-medium"
            htmlFor="matrix-coverage-filter"
          >
            Coverage
          </label>
          <Select
            value={effectiveCoverageFilter}
            onValueChange={(value) =>
              setCoverageFilter(value as MatrixCoverageFilter)
            }
          >
            <SelectTrigger
              id="matrix-coverage-filter"
              className="w-full min-w-44 sm:w-52"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All cells</SelectItem>
              <SelectItem value="MISSING">Missing</SelectItem>
              <SelectItem value="ASSIGNED">Assigned</SelectItem>
              <SelectItem value="MIXED_BY_TERM" disabled={Boolean(termId)}>
                Mixed by Term{termId ? " (All Terms only)" : ""}
              </SelectItem>
              <SelectItem value="PROTECTED">Protected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1 sm:w-auto">
          <label className="text-sm font-medium" htmlFor="matrix-teacher-focus">
            Teacher
          </label>
          <SearchableSelect
            id="matrix-teacher-focus"
            ariaLabel="Teacher focus"
            value={teacherFocus}
            onValueChange={setTeacherFocus}
            options={teacherOptions}
            placeholder="All Teachers"
            className="w-full min-w-64 sm:w-80"
          />
        </div>
        <Button
          type="button"
          variant={selectionMode ? "secondary" : "outline"}
          onClick={() => setSelectionMode((current) => !current)}
        >
          Select cells
        </Button>
        {selectionMode && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!visibleDetails.length}
              onClick={selectAllVisible}
            >
              Select all visible
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!selected.length && !copySource}
              onClick={clearSelection}
            >
              Clear selection
            </Button>
            <span className="text-sm text-muted-foreground">
              {selected.length} cell{selected.length === 1 ? "" : "s"} selected,{" "}
              {actionableScopeCount} actionable assignment scope
              {actionableScopeCount === 1 ? "" : "s"}
            </span>
            <Select
              value={bulkTeacherId}
              onValueChange={(value) => setBulkTeacherId(value ?? "")}
            >
              <SelectTrigger
                aria-label="Teacher for selected cells"
                className="min-w-64"
              >
                <SelectValue>
                  {bulkTeacher ? teacherLabel(bulkTeacher) : "Choose Teacher"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.data?.teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacherLabel(teacher)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={
                !bulkTeacherId || !actionableScopeCount || mutation.isPending
              }
              onClick={fillSelected}
            >
              Fill selected
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !selected.some((item) =>
                  item.cell.termAssignments.some(
                    (term) => term.assignmentId && term.ownershipEditable,
                  ),
                ) || mutation.isPending
              }
              onClick={clearSelected}
            >
              Clear selected future scopes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!copySource || !selected.length || mutation.isPending}
              onClick={copyToSelected}
            >
              Copy to selected Sections
            </Button>
            {copySource && (
              <span className="text-sm text-muted-foreground">
                Copy source: {copySource.offering.subjectCode} /{" "}
                {copySource.section.sectionName}
              </span>
            )}
          </>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
      {!projectedOfferings.length || !matrix.sections.length ? (
        <div className="mt-4 rounded-md border p-8 text-center text-sm text-muted-foreground">
          No eligible Curriculum Offerings or organizational Sections exist for
          Grade {matrix.gradeLevel}.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background">
                  Offering
                </TableHead>
                {matrix.sections.map((section) => (
                  <TableHead key={section.id} className="min-w-44">
                    {section.sectionName}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectedOfferings.map((offering) => (
                <TableRow key={offering.id}>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium">
                    <div>{offering.subjectCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {offering.subjectDescription}
                    </div>
                  </TableCell>
                  {offering.cells.map((cell) => {
                    const section = matrix.sections.find(
                      (item) => item.id === cell.sectionId,
                    );
                    if (!section) return null;
                    const item: Detail = { cell, offering, section };
                    const key = cellKey(offering.id, cell.sectionId);
                    const visible =
                      matchesMatrixTeacherFocus(cell, teacherFocus) &&
                      matchesMatrixCoverageFilter(
                        cell,
                        effectiveCoverageFilter,
                      );
                    const matchingTerms =
                      teacherFocus !== "ALL" && teacherFocus !== "UNASSIGNED"
                        ? matchingTeacherTerms(cell, teacherFocus)
                        : [];
                    const matchingLabel =
                      matchingTerms.length && selectedTeacher
                        ? `Matches ${matchingTerms.map((term) => `T${term.academicTermPosition}`).join(", ")}`
                        : null;
                    const secondaryStatus = [
                      cell.missingScopeCount > 0
                        ? `${cell.missingScopeCount} missing`
                        : null,
                      cell.protectedScopeCount > 0
                        ? `${cell.protectedScopeCount} protected`
                        : null,
                      cell.startedUnassignedScopeCount > 0
                        ? "Initial assignment allowed"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const termLabel = cell.termAssignments
                      .map(
                        (term) =>
                          `${term.academicTermName}: ${term.teacher?.name ?? "Unassigned"}, ${termStatus(term)}`,
                      )
                      .join("; ");
                    return (
                      <TableCell key={cell.sectionId}>
                        {visible && (
                          <div className="flex items-start gap-1">
                            {selectionMode && (
                              <Checkbox
                                aria-label={`Select ${offering.subjectCode} ${section.sectionName}`}
                                checked={Boolean(selectedCells[key])}
                                onCheckedChange={(checked) =>
                                  toggleCell(item, checked === true)
                                }
                              />
                            )}
                            <Button
                              variant="ghost"
                              className="h-auto w-full justify-start p-2 text-left"
                              aria-label={`${offering.subjectCode}, ${section.sectionName}: ${termLabel}. ${matchingLabel ?? ""}`}
                              onClick={() => {
                                setDetail(item);
                                setCopySource(item);
                              }}
                            >
                              <span className="space-y-0.5">
                                <span
                                  className={
                                    cell.state === "UNASSIGNED"
                                      ? "block text-muted-foreground"
                                      : cell.state === "MIXED_BY_TERM"
                                        ? "block text-amber-700"
                                        : "block font-medium"
                                  }
                                >
                                  {cell.state === "UNASSIGNED"
                                    ? "Unassigned"
                                    : cell.state === "MIXED_BY_TERM"
                                      ? "Mixed by Term"
                                      : cell.termAssignments[0]?.teacher?.name}
                                </span>
                                {matchingLabel && (
                                  <span className="block text-xs text-muted-foreground">
                                    {matchingLabel}
                                  </span>
                                )}
                                {secondaryStatus && (
                                  <span className="block text-xs text-muted-foreground">
                                    {secondaryStatus}
                                  </span>
                                )}
                              </span>
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="mt-6 rounded-md border">
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <h2 className="font-semibold">Teacher Load (informational)</h2>
            <p className="text-sm text-muted-foreground">
              {termId
                ? `${selectedTerm?.name ?? "Selected Term"} counts across the active Academic Year.`
                : "Active Academic Year-wide counts across grades."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowLoads((current) => !current)}
            aria-expanded={showLoads}
          >
            {showLoads ? "Hide load" : "Show load"}
          </Button>
        </div>
        {showLoads && (
          <ScrollArea className="max-h-72 border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>
                    {termId
                      ? `${selectedTerm?.name ?? "Term"} assignment scopes`
                      : "Assignment scopes"}
                  </TableHead>
                  <TableHead>Offerings</TableHead>
                  <TableHead>Sections</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadRows.map((load) => {
                  const termLoad = termId
                    ? load.termLoads.find(
                        (term) => term.academicTermId === termId,
                      )
                    : null;
                  return (
                    <TableRow key={load.teacherId}>
                      <TableCell>{teacherLabel(load)}</TableCell>
                      <TableCell>
                        {termId
                          ? (termLoad?.assignmentScopeCount ?? 0)
                          : load.activeAssignmentScopeCount}
                      </TableCell>
                      <TableCell>
                        {termId
                          ? (termLoad?.distinctOfferingCount ?? 0)
                          : load.distinctOfferingCount}
                      </TableCell>
                      <TableCell>
                        {termId
                          ? (termLoad?.distinctSectionCount ?? 0)
                          : load.distinctSectionCount}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loadRows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No active Teacher assignments in this scope.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
      <div className="mt-6">
        <div className="mb-2">
          <h2 className="font-semibold">Missing Coverage</h2>
          <p className="text-sm text-muted-foreground">
            {teacherFocus === "ALL"
              ? "All Teachers"
              : teacherFocus === "UNASSIGNED"
                ? "Unassigned focus"
                : `Teacher focus: ${selectedTeacher ? teacherLabel(selectedTeacher) : "selected Teacher"}`}
            ; {termId ? selectedTerm?.name : "All Terms"}. This summary remains
            available regardless of the coverage filter.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offering</TableHead>
                <TableHead>Missing assignment scopes</TableHead>
                <TableHead>Affected Sections</TableHead>
                <TableHead>Affected Terms</TableHead>
                <TableHead>
                  <span className="sr-only">Details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missingGroups.map((group) => (
                <TableRow key={group.offeringId}>
                  <TableCell>
                    <div className="font-medium">{group.offeringCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.offeringDescription}
                    </div>
                  </TableCell>
                  <TableCell>{group.scopes.length}</TableCell>
                  <TableCell>{group.sectionNames.join(", ")}</TableCell>
                  <TableCell>{group.termNames.join(", ")}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMissingGroup(group)}
                    >
                      View details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!missingGroups.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    All displayed assignment scopes are covered.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <CellDialog
        key={
          detail
            ? `${cellKey(detail.offering.id, detail.section.id)}:${termId ?? "all"}`
            : "closed"
        }
        detail={detail}
        matrix={matrix}
        onClose={() => setDetail(null)}
      />
      <MissingCoverageDialog
        group={missingGroup}
        onClose={() => setMissingGroup(null)}
      />
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              Review the exact requested assignment scopes. The command is
              all-or-nothing.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2 pr-4 text-sm">
              <p className="font-medium">
                {preview?.scopeLabels.length ?? 0} exact assignment scope
                {preview?.scopeLabels.length === 1 ? "" : "s"}
              </p>
              {preview?.scopeLabels.map((label) => (
                <div key={label} className="rounded-md border p-2">
                  {label}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreview(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void confirmPreview()}
            >
              {mutation.isPending ? "Applying..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
