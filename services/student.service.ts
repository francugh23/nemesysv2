import {
  countNonArchivedStudents,
  createStudent,
  createStudents,
  findStudentByLRN,
  findStudentFilterOptionValues,
  findStudentsByLRNs,
  findNonArchivedStudents,
  findNonArchivedStudentsByGrade,
  findNonArchivedStudentsForExport,
  findNonArchivedStudentsForExportByGrade,
  updateStudent,
  softDeleteStudent,
  type StudentExportProjection,
} from "@/repositories/student.repository";
import { createAuditLogs } from "@/repositories/audit.repository";

import {
  CreateStudentSchema,
  type StudentTableQuery,
} from "@/schemas";

import { createAuditLog } from "@/services/audit.service";

import prisma from "@/lib/prisma";
import { Permissions, requirePermission } from "@/lib/authorization";
import {
  formatExportDate,
  formatExportEnum,
} from "@/lib/export/format";
import { formatFullName } from "@/lib/format";
import { Prisma } from "@/app/generated/prisma/client";
import type { StudentFilterOptions, StudentPage } from "@/types/student";
import type {
  DownloadableFile,
  ExportDefinition,
  ExportFormat,
} from "@/types/export";
import { generateExport } from "@/services/export.service";

import { z } from "zod";

function getStudentOrderBy(
  query: StudentTableQuery,
): Prisma.StudentOrderByWithRelationInput[] {
  const direction = query.direction ?? "asc";

  switch (query.sort) {
    case "lrn":
      return [{ lrn: direction }, { id: "asc" }];
    case "name":
      return [
        { lastName: direction },
        { firstName: direction },
        { middleName: direction },
        { lrn: direction },
        { id: "asc" },
      ];
    case "gender":
      return [{ gender: direction }, { id: "asc" }];
    case "status":
      return [{ status: direction }, { id: "asc" }];
    case "currentSection":
      return [
        { currentSection: { sectionName: direction } },
        { id: "asc" },
      ];
    case "createdAt":
      return [{ createdAt: direction }, { id: "asc" }];
    default:
      return [
        { lastName: "asc" },
        { firstName: "asc" },
        { middleName: "asc" },
        { lrn: "asc" },
        { id: "asc" },
      ];
  }
}

function getStudentListFilters(query: StudentTableQuery) {
  return {
    search: query.q,
    status: query.status,
    gender: query.gender,
    grade: query.grade,
    sectionId: query.sectionId,
  };
}

export async function getStudents(
  query: StudentTableQuery,
): Promise<StudentPage> {
  await requirePermission(Permissions.STUDENTS);

  const filters = getStudentListFilters(query);
  const totalCount = await countNonArchivedStudents(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const pagination = {
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  };
  const students =
    query.sort === "grade"
      ? await findNonArchivedStudentsByGrade(
          filters,
          pagination,
          query.direction ?? "asc",
        )
      : await findNonArchivedStudents(
          filters,
          pagination,
          getStudentOrderBy(query),
        );

  return {
    items: students,
    totalCount,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

function getStudentExportDefinition(
  transaction: Prisma.TransactionClient,
): ExportDefinition<StudentTableQuery, StudentExportProjection> {
  return {
    fileSlug: "students",
    sheetName: "Students",
    columns: [
      { header: "LRN" },
      { header: "Name" },
      { header: "Gender" },
      { header: "Status" },
      { header: "Grade" },
      { header: "Current Section" },
      { header: "Created Date" },
    ],
    count: (query) =>
      countNonArchivedStudents(getStudentListFilters(query), transaction),
    loadBatch: (query, pagination) => {
      const filters = getStudentListFilters(query);

      return query.sort === "grade"
        ? findNonArchivedStudentsForExportByGrade(
            filters,
            pagination,
            query.direction ?? "asc",
            transaction,
          )
        : findNonArchivedStudentsForExport(
            filters,
            pagination,
            getStudentOrderBy(query),
            transaction,
          );
    },
    mapProjection: (student) => [
      student.lrn,
      formatFullName(
        student.firstName,
        student.middleName,
        student.lastName,
      ),
      formatExportEnum(student.gender),
      formatExportEnum(student.status),
      student.currentSection?.gradeLevel ?? "-",
      student.currentSection?.sectionName ?? "-",
      formatExportDate(student.createdAt),
    ],
  };
}

export async function exportStudents(
  query: StudentTableQuery,
  format: ExportFormat,
): Promise<DownloadableFile> {
  await requirePermission(Permissions.STUDENTS);

  return prisma.$transaction(
    (transaction) =>
      generateExport(
        query,
        format,
        getStudentExportDefinition(transaction),
      ),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30_000,
    },
  );
}

export async function getStudentFilterOptions(): Promise<StudentFilterOptions> {
  await requirePermission(Permissions.STUDENTS);

  const [statuses, genders, sections] = await findStudentFilterOptionValues();
  const statusOrder = [
    "UNENROLLED",
    "ENROLLED",
    "GRADUATED",
    "TRANSFERRED",
    "DROPPED",
  ];
  const genderOrder = ["MALE", "FEMALE"];
  const sortedSections = sections.sort((first, second) => {
    const gradeDifference = Number(first.gradeLevel) - Number(second.gradeLevel);

    if (gradeDifference !== 0) {
      return gradeDifference;
    }

    const trackDifference = (first.trackStrand ?? "").localeCompare(
      second.trackStrand ?? "",
    );

    return trackDifference !== 0
      ? trackDifference
      : first.sectionName.localeCompare(second.sectionName);
  });

  return {
    statuses: statuses
      .map((value) => value.status)
      .sort(
        (first, second) =>
          statusOrder.indexOf(first) - statusOrder.indexOf(second),
      ),
    genders: genders
      .map((value) => value.gender)
      .sort(
        (first, second) =>
          genderOrder.indexOf(first) - genderOrder.indexOf(second),
      ),
    gradeLevels: [...new Set(sortedSections.map((section) => section.gradeLevel))],
    sections: sortedSections,
  };
}

export async function createStudentService(
  values: z.infer<typeof CreateStudentSchema>,
) {
  const session = await requirePermission(Permissions.STUDENTS);

  const existingStudent = await findStudentByLRN(values.lrn);

  if (existingStudent) {
    throw new Error("LRN already exists.");
  }

  const student = await createStudent({
    ...values,

    status: "UNENROLLED",

    createdBy: {
      connect: {
        id: session.user.id,
      },
    },
  });

  await createAuditLog({
    action: "CREATE",
    module: "Student",
    recordId: student.id,
    recordName: `${student.lastName}, ${student.firstName}`,
    description: "Created student profile",
  });

  return student;
}

export async function importStudentsService(
  values: z.infer<typeof CreateStudentSchema>[],
) {
  const session = await requirePermission(Permissions.STUDENTS);

  const existingStudents = await findStudentsByLRNs(
    values.map((student) => student.lrn),
  );
  const existingLRNs = new Set(existingStudents.map((student) => student.lrn));
  const studentsToCreate = values.filter(
    (student) => !existingLRNs.has(student.lrn),
  );

  if (studentsToCreate.length === 0) {
    return {
      importedCount: 0,
      skippedCount: values.length,
    };
  }

  const result = await prisma.$transaction(async (transaction) => {
    const createdStudents = await createStudents(
      studentsToCreate.map((student) => ({
        ...student,
        status: "UNENROLLED",
        createdById: session.user.id,
      })),
      transaction,
    );

    await createAuditLogs(
      studentsToCreate.map((student) => ({
        userId: session.user.id,
        action: "CREATE",
        module: "Student",
        recordName: `${student.lastName}, ${student.firstName}`,
        description: "Imported student profile",
      })),
      transaction,
    );

    return createdStudents;
  });

  return {
    importedCount: result.count,
    skippedCount: values.length - result.count,
  };
}

export async function updateStudentService(
  id: string,
  values: z.infer<typeof CreateStudentSchema>,
) {
  await requirePermission(Permissions.STUDENTS);

  const student = await updateStudent(id, {
    ...values,
  });

  await createAuditLog({
    action: "UPDATE",
    module: "Student",
    recordId: student.id,
    recordName: `${student.lastName}, ${student.firstName}`,
    description: "Updated student profile",
  });

  return student;
}

export async function deleteStudentService(id: string) {
  await requirePermission(Permissions.STUDENTS);

  const student = await softDeleteStudent(id);

  await createAuditLog({
    action: "DELETE",
    module: "Student",
    recordId: student.id,
    recordName: `${student.lastName}, ${student.firstName}`,
    description: "Soft deleted student profile",
  });

  return student;
}
