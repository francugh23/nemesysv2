"use client";

import { useMemo, useState } from "react";

import type { Student } from "@/app/generated/prisma/client";

export function useStudentFilters(students: Student[]) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [gender, setGender] = useState("all");

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        search === "" ||
        student.lrn.toLowerCase().includes(search.toLowerCase()) ||
        student.firstName.toLowerCase().includes(search.toLowerCase()) ||
        student.lastName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = status === "all" || student.status === status;

      const matchesGender = gender === "all" || student.gender === gender;

      return matchesSearch && matchesStatus && matchesGender;
    });
  }, [students, search, status, gender]);

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setGender("all");
  }

  return {
    filteredStudents,

    search,
    setSearch,

    status,
    setStatus,

    gender,
    setGender,

    resetFilters,
  };
}