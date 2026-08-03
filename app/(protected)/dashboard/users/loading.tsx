import { Plus } from "lucide-react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { UserTableSkeleton } from "@/components/skeletons/user-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            View and filter system user accounts and access states.
          </p>
        </div>

        <CrudToolbar
          primaryAction={
            <Button disabled>
              <Plus />
              Add User
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <UserTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
