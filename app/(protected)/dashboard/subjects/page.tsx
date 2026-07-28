"use client";

import { DataTable } from "@/components/data-table";
import { CrudToolbar } from "@/components/common/crud-toolbar";
import { SubjectTableSkeleton } from "@/components/skeletons/subject-table-skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Subject Records</h1>
          <p className="text-sm text-muted-foreground">
            View available subjects by grade level.
          </p>
        </div>

        <CrudToolbar
          primaryAction={<CreateSubjectDialog />}
          actions={
            <SubjectImportDialog
              trigger={<Button variant="outline">Import Subject</Button>}
            />
          }
        />
      </div>

      <Card>
        <CardContent className="pt-6">
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
