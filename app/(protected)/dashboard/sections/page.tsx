"use client";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { SectionTableSkeleton } from "@/components/skeletons/section-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSections } from "@/hooks/section.hook";
import type { SectionListItem } from "@/schemas";
import { useMemo, useState } from "react";

import { sectionColumns } from "./components/section-columns";
import { CreateSectionDialog } from "./components/create-section-dialog";
import {
  SectionDialogManager,
  type SectionDialogType,
} from "./components/section-dialog-manager";

export default function SectionsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSections();
  const [{ selectedSection, dialog, instanceId }, setDialogState] = useState<{
    selectedSection: SectionListItem | null;
    dialog: SectionDialogType;
    instanceId: number;
  }>({
    selectedSection: null,
    dialog: null,
    instanceId: 0,
  });
  const columns = useMemo(
    () =>
      sectionColumns({
        onEdit: (section) => {
          setDialogState((current) => ({
            selectedSection: section,
            dialog: "edit",
            instanceId: current.instanceId + 1,
          }));
        },
        onArchive: (section) => {
          setDialogState((current) => ({
            selectedSection: section,
            dialog: "archive",
            instanceId: current.instanceId + 1,
          }));
        },
      }),
    [],
  );

  function closeDialog(closingInstanceId: number) {
    setDialogState((current) =>
      current.instanceId === closingInstanceId
        ? { ...current, selectedSection: null, dialog: null }
        : current,
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Section Records</h1>
          <p className="text-sm text-muted-foreground">
            View active sections by grade level and track or strand.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateSectionDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <SectionTableSkeleton />
          ) : isError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="space-y-1">
                <p className="font-medium">Unable to load section records</p>
                <p className="text-sm text-muted-foreground">
                  Check your connection and try again.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? "Retrying..." : "Try again"}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data ?? []}
              onRowClick={(section) => {
                setDialogState((current) => ({
                  selectedSection: section,
                  dialog: "view",
                  instanceId: current.instanceId + 1,
                }));
              }}
            />
          )}
          <SectionDialogManager
            section={selectedSection}
            dialog={dialog}
            instanceId={instanceId}
            onClose={closeDialog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
