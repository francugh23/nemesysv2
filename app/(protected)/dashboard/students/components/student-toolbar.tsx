"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { StudentListItem } from "@/types/student";
import type { Table } from "@tanstack/react-table";
import { useState } from "react";

interface StudentToolbarProps {
  table: Table<StudentListItem>;
}
export function StudentToolbar({ table }: StudentToolbarProps) {
  const [search, setSearch] = useState("");
  return (
    <div className="space-y-4">
      <Input
        placeholder="Search students..."
        value={search}
        onChange={(event) => {
          const value = event.target.value;

          setSearch(value);

          table.getColumn("lastName")?.setFilterValue(value);
        }}
        className="max-w-sm"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select disabled>
          <SelectTrigger className="w-42.5">
            <SelectValue placeholder="Status" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="ENROLLED">Enrolled</SelectItem>
            <SelectItem value="UNENROLLED">Unenrolled</SelectItem>
            <SelectItem value="GRADUATED">Graduated</SelectItem>
            <SelectItem value="TRANSFERRED">Transferred</SelectItem>
            <SelectItem value="DROPPED">Dropped</SelectItem>
          </SelectContent>
        </Select>

        <Select disabled>
          <SelectTrigger className="w-42.5">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" disabled>
          Reset
        </Button>
      </div>
    </div>
  );
}
