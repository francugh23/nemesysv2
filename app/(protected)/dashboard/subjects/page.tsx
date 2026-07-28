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
import { EditSubjectDialog } from "./components/edit-subject-dialog";
import { subjectColumns } from "./components/subject-columns";
import { SubjectViewDialog } from "./components/subject-view-dialog";

export default function SubjectsPage() {
  const { data, isLoading } = useSubjects();
  const [selectedSubject, setSelectedSubject] =
    useState<SubjectListItem | null>(null);
  const [dialog, setDialog] = useState<"view" | "edit" | null>(null);
  const columns = useMemo(
    () =>
      subjectColumns({
        onEdit: (subject) => {
          setSelectedSubject(subject);
          setDialog("edit");
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
          <div className="mb-4 flex justify-end">
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
              {selectedSubject && (
                <>
                  <SubjectViewDialog
                    subject={selectedSubject}
                    open={dialog === "view"}
                    onOpenChange={(open) => !open && closeDialog()}
                  />
                  <EditSubjectDialog
                    subject={selectedSubject}
                    open={dialog === "edit"}
                    onOpenChange={(open) => !open && closeDialog()}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
