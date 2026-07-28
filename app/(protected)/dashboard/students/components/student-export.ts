import type { Student } from "@/app/generated/prisma/client";
import { displayValue, formatDate } from "@/lib/format";
import type { ExportDefinition } from "@/types/export";

function formatStatus(status: Student["status"]) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export const studentExportDefinition: ExportDefinition<Student> = {
  fileName: "students.xlsx",
  sheetName: "Students",
  columns: [
    { header: "LRN", value: (student) => student.lrn },
    { header: "Last Name", value: (student) => student.lastName },
    { header: "First Name", value: (student) => student.firstName },
    { header: "Middle Name", value: (student) => displayValue(student.middleName) },
    {
      header: "Gender",
      value: (student) => (student.gender === "MALE" ? "Male" : "Female"),
    },
    { header: "Status", value: (student) => formatStatus(student.status) },
    { header: "Birth Date", value: (student) => formatDate(student.dateOfBirth) },
    { header: "Father", value: (student) => displayValue(student.fatherName) },
    {
      header: "Father Contact",
      value: (student) => displayValue(student.fatherContact),
    },
    { header: "Mother", value: (student) => displayValue(student.motherName) },
    {
      header: "Mother Contact",
      value: (student) => displayValue(student.motherContact),
    },
    { header: "Guardian", value: (student) => displayValue(student.guardianName) },
    {
      header: "Guardian Contact",
      value: (student) => displayValue(student.guardianContact),
    },
    { header: "Purok", value: (student) => displayValue(student.purok) },
    { header: "Barangay", value: (student) => student.barangay },
    { header: "Municipality", value: (student) => student.municipality },
    { header: "Province", value: (student) => student.province },
    { header: "Zip Code", value: (student) => displayValue(student.zipCode) },
  ],
};
