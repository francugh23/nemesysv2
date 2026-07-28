"use client";

import { DataTable } from "@/components/data-table";
import { SubjectTableSkeleton } from "@/components/skeletons/subject-table-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSubjects } from "@/hooks/subject.hook";
import type { SubjectListItem } from "@/schemas";
import { useMemo, useState } from "react";

import { CreateSubjectDialog } from "./components/create-subject-dialog";
import { SubjectImportDialog } from "./components/subject-import-dialog";
import {
  SubjectDialogManager,
  SubjectDialogType,
} from "./components/subject-dialog-manager";
import { subjectColumns } from "./components/subject-columns";

export default function SubjectsPage() {
  const { data, isLoading } = useSubjects();
  const [selectedSubject, setSelectedSubject] =
    useState<SubjectListItem | null>(null);
  const [dialog, setDialog] = useState<SubjectDialogType>(null);
  const columns = useMemo(
    () =>
      subjectColumns({
        onEdit: (subject) => {
          setSelectedSubject(subject);
          setDialog("edit");
        },
        onArchive: (subject) => {
          setSelectedSubject(subject);
          setDialog("archive");
        },
      }),
    [],
  );

  function closeDialog() {
    setSelectedSubject(null);
    setDialog(null);
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Subject Records</CardTitle>
          <CardDescription>View available subjects by grade level.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-4 flex justify-end gap-2">
            <SubjectImportDialog />
            <CreateSubjectDialog />
          </div>

          {isLoading ? (
            <SubjectTableSkeleton />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={data ?? []}
                onRowClick={(subject) => {
                  setSelectedSubject(subject);
                  setDialog("view");
                }}
              />
              <SubjectDialogManager
                subject={selectedSubject}
                dialog={dialog}
                onClose={closeDialog}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
