"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StudentActions } from "./student-actions";
import { Student } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";

export const studentColumns: ColumnDef<Student>[] = [
  {
    accessorKey: "lrn",
    header: "LRN",
  },

  {
    accessorKey: "lastName",

    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Last Name
      </Button>
    ),
  },

  {
    accessorKey: "firstName",
    header: "First Name",
  },

  {
    accessorKey: "middleName",
    header: "Middle Name",
    cell: ({ row }) => row.original.middleName ?? "-",
  },

  {
    accessorKey: "gender",
    header: "Gender",
  },

  {
    accessorKey: "status",
    header: "Status",
  },
  {
    id: "actions",

    cell: ({ row }) => {
      const student = row.original;

      return <StudentActions student={student} />;
    },
  },
];
