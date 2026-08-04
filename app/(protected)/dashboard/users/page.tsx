"use client";

import { Download } from "lucide-react";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { UserTableSkeleton } from "@/components/skeletons/user-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUsers } from "@/hooks/user.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  UserFirstLoginFilterSchema,
  UserRoleSchema,
  UserStatusSchema,
  type UserTableQueryInput,
  type UserListItem,
} from "@/schemas";

import { userColumns } from "./components/user-columns";
import { CreateUserDialog } from "./components/create-user-dialog";
import { EditUserDialog } from "./components/edit-user-dialog";
import { ResetUserPasswordDialog } from "./components/reset-user-password-dialog";
import { ChangeUserStatusDialog } from "./components/change-user-status-dialog";
import { ChangeUserRoleDialog } from "./components/change-user-role-dialog";
import { userFilterKeys, UserToolbar } from "./components/user-toolbar";

const userSortFields = [
  "employeeNumber",
  "username",
  "name",
  "role",
  "status",
  "firstLogin",
  "createdAt",
] as const;

export default function UsersPage() {
  return (
    <Suspense fallback={<UserTableSkeleton />}>
      <UsersPageContent />
    </Suspense>
  );
}

function UsersPageContent() {
  const { data: session } = useSession();
  const tableState = useTableUrlState({
    filterKeys: userFilterKeys,
    sortableColumns: userSortFields,
  });
  const role = UserRoleSchema.safeParse(tableState.filters.role);
  const status = UserStatusSchema.safeParse(tableState.filters.status);
  const firstLogin = UserFirstLoginFilterSchema.safeParse(
    tableState.filters.firstLogin,
  );
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.role && !role.success) {
      tableState.setFilter("role", "");
    }

    if (tableState.filters.status && !status.success) {
      tableState.setFilter("status", "");
    }

    if (tableState.filters.firstLogin && !firstLogin.success) {
      tableState.setFilter("firstLogin", "");
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const query: UserTableQueryInput = {
    q: search || undefined,
    role: role.success ? role.data : undefined,
    status: status.success ? status.data : undefined,
    firstLogin: firstLogin.success
      ? (tableState.filters.firstLogin as "true" | "false")
      : undefined,
    sort: tableState.query.sort as UserTableQueryInput["sort"],
    direction: tableState.query.direction as UserTableQueryInput["direction"],
    page: tableState.query.page,
    pageSize: tableState.query.pageSize,
  };
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    isPlaceholderData,
  } = useUsers(query);
  const [{ selectedUser, dialog, instanceId }, setDialogState] = useState<{
    selectedUser: UserListItem | null;
    dialog: "edit" | "reset-password" | "status" | "role" | null;
    instanceId: number;
  }>({ selectedUser: null, dialog: null, instanceId: 0 });
  const columns = useMemo(
    () =>
      userColumns({
        currentActorId: session?.user.id,
        onEdit: (user) => {
          setDialogState((current) => ({
            selectedUser: user,
            dialog: "edit",
            instanceId: current.instanceId + 1,
          }));
        },
        onResetPassword: (user) => {
          setDialogState((current) => ({ selectedUser: user, dialog: "reset-password", instanceId: current.instanceId + 1 }));
        },
        onChangeStatus: (user) => {
          setDialogState((current) => ({ selectedUser: user, dialog: "status", instanceId: current.instanceId + 1 }));
        },
        onChangeRole: (user) => {
          setDialogState((current) => ({ selectedUser: user, dialog: "role", instanceId: current.instanceId + 1 }));
        },
      }),
    [session?.user.id],
  );
  const reconcilePage = useEffectEvent((page: number) => {
    tableState.onPaginationChange({
      ...tableState.pagination,
      pageIndex: page - 1,
    });
  });
  const displayedPagination =
    isPlaceholderData && data
      ? { pageIndex: data.page - 1, pageSize: data.pageSize }
      : tableState.pagination;

  function closeDialog(closingInstanceId: number) {
    setDialogState((current) =>
      current.instanceId === closingInstanceId
        ? { ...current, selectedUser: null, dialog: null }
        : current,
    );
  }

  useEffect(() => {
    normalizeUrl();
  }, [
    firstLogin.success,
    role.success,
    search,
    status.success,
    tableState.filters.firstLogin,
    tableState.filters.role,
    tableState.filters.status,
    tableState.query.q,
  ]);

  useEffect(() => {
    if (
      data &&
      !isPlaceholderData &&
      data.page !== tableState.pagination.pageIndex + 1
    ) {
      reconcilePage(data.page);
    }
  }, [data, isPlaceholderData, tableState.pagination.pageIndex]);

  const errorFallback = (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div className="space-y-1">
        <p className="font-medium">Unable to load user records</p>
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
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            View and filter system user accounts and access states.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateUserDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            toolbar={() => (
              <UserToolbar
                search={tableState.search}
                onSearchChange={tableState.setSearch}
                filters={tableState.filters}
                onFilterChange={tableState.setFilter}
                canReset={tableState.canReset}
                onReset={tableState.reset}
                isFetching={isFetching && !isLoading}
                searchResetKey={tableState.resetKey}
                actions={
                  <Button variant="outline" disabled>
                    <Download />
                    Export
                  </Button>
                }
              />
            )}
            server={{
              pagination: displayedPagination,
              sorting: tableState.sorting,
              pageCount: data?.pageCount ?? 0,
              totalCount: data?.totalCount ?? 0,
              onPaginationChange: tableState.onPaginationChange,
              onSortingChange: tableState.onSortingChange,
              pageSizeOptions: tableState.pageSizeOptions,
              disabled: isPlaceholderData,
            }}
            state={{
              isLoading,
              isError,
              isFetching,
              loadingFallback: <UserTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching user records"
                : "No user records yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and filters."
                : "User accounts will appear here when they are available.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>
                  Clear filters
                </Button>
              ) : undefined,
            }}
          />
        </CardContent>
      </Card>

      {selectedUser && dialog === "edit" && (
        <EditUserDialog
          key={instanceId}
          user={selectedUser}
          open
          onOpenChange={(open) => {
            if (!open) {
              closeDialog(instanceId);
            }
          }}
        />
      )}
      {selectedUser && dialog === "reset-password" && (
        <ResetUserPasswordDialog key={instanceId} user={selectedUser} open onOpenChange={(open) => { if (!open) closeDialog(instanceId); }} />
      )}
      {selectedUser && dialog === "status" && (
        <ChangeUserStatusDialog key={instanceId} user={selectedUser} open onOpenChange={(open) => { if (!open) closeDialog(instanceId); }} />
      )}
      {selectedUser && dialog === "role" && (
        <ChangeUserRoleDialog key={instanceId} user={selectedUser} open onOpenChange={(open) => { if (!open) closeDialog(instanceId); }} />
      )}
    </div>
  );
}
