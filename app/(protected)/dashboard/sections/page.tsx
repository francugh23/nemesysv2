"use client";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { SectionTableSkeleton } from "@/components/skeletons/section-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSections } from "@/hooks/section.hook";

import { sectionColumns } from "./components/section-columns";
import { CreateSectionDialog } from "./components/create-section-dialog";

export default function SectionsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSections();

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
              columns={sectionColumns}
              data={data ?? []}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
