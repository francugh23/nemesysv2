import prisma from "@/lib/prisma";
import { Prisma, type AcademicYearStatus } from "@/app/generated/prisma/client";

export interface SubjectAssignmentIdentity {
  subjectOfferingId: string;
  academicTermId: string;
  sectionId: string;
}

const client = (transaction?: Prisma.TransactionClient) => transaction ?? prisma;

export function findActiveAcademicYearsForAssignment() {
  return prisma.academicYear.findMany({ where: { status: "ACTIVE" }, select: { id: true, label: true }, orderBy: [{ startDate: "desc" }, { id: "asc" }] });
}

export function findAssignmentScope(subjectOfferingId: string, academicTermId: string, transaction?: Prisma.TransactionClient) {
  return client(transaction).subjectOfferingTerm.findUnique({
    where: { subjectOfferingId_academicTermId: { subjectOfferingId, academicTermId } },
    select: { academicTerm: { select: { id: true, name: true, position: true, startDate: true, endDate: true } }, subjectOffering: { select: { id: true, gradeLevel: true, subjectCode: true, subjectDescription: true, deletedAt: true, academicYear: { select: { id: true, label: true, status: true } }, shsContext: { select: { curriculumStatus: true } } } } },
  });
}

export function findAssignmentScopes() {
  return prisma.subjectOfferingTerm.findMany({
    where: { subjectOffering: { deletedAt: null, academicYear: { status: "ACTIVE" } } },
    select: { subjectOfferingId: true, academicTermId: true, academicTerm: { select: { name: true, position: true } }, subjectOffering: { select: { academicYearId: true, gradeLevel: true, subjectCode: true, subjectDescription: true, shsContext: { select: { curriculumStatus: true } } } } },
    orderBy: [{ subjectOffering: { gradeLevel: "asc" } }, { subjectOffering: { subjectCode: "asc" } }, { academicTerm: { position: "asc" } }],
  });
}

export function findActiveSubjectAssignment(identity: SubjectAssignmentIdentity, transaction?: Prisma.TransactionClient) {
  return client(transaction).subjectAssignment.findFirst({ where: { ...identity, deletedAt: null }, select: { id: true } });
}

export function findActiveSubjectAssignmentsForMatrixMutation(
  identities: SubjectAssignmentIdentity[],
  transaction?: Prisma.TransactionClient,
) {
  if (!identities.length) return Promise.resolve([]);
  return client(transaction).subjectAssignment.findMany({
    where: { deletedAt: null, OR: identities },
    select: { id: true, teacherId: true, subjectOfferingId: true, academicTermId: true, sectionId: true },
  });
}

export function findActiveSubjectAssignmentById(id: string, transaction?: Prisma.TransactionClient) {
  return client(transaction).subjectAssignment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, teacherId: true, sectionId: true, subjectOfferingId: true, academicTermId: true, subjectOfferingTerm: { select: { academicTerm: { select: { name: true, position: true, startDate: true, endDate: true } }, subjectOffering: { select: { gradeLevel: true, subjectCode: true, subjectDescription: true, academicYear: { select: { label: true, status: true } } } } } }, teacher: { select: { employeeNumber: true, firstName: true, middleName: true, lastName: true } }, section: { select: { gradeLevel: true, sectionName: true } } },
  });
}

export function createSubjectAssignment(data: Prisma.SubjectAssignmentUncheckedCreateInput, transaction?: Prisma.TransactionClient) { return client(transaction).subjectAssignment.create({ data }); }
export function updateSubjectAssignment(id: string, data: Prisma.SubjectAssignmentUncheckedUpdateInput, transaction?: Prisma.TransactionClient) { return client(transaction).subjectAssignment.update({ where: { id }, data }); }
export function archiveSubjectAssignment(id: string, transaction?: Prisma.TransactionClient) { return client(transaction).subjectAssignment.update({ where: { id }, data: { deletedAt: new Date() } }); }

export function findAllSubjectAssignments() {
  return prisma.subjectAssignment.findMany({
    where: { deletedAt: null },
    select: { id: true, teacherId: true, subjectOfferingId: true, academicTermId: true, sectionId: true, teacher: { select: { employeeNumber: true, firstName: true, middleName: true, lastName: true } }, section: { select: { gradeLevel: true, sectionName: true } }, subjectOfferingTerm: { select: { academicTerm: { select: { name: true, position: true } }, subjectOffering: { select: { subjectCode: true, subjectDescription: true, academicYear: { select: { id: true, label: true, status: true } } } } } } },
    orderBy: [{ subjectOfferingTerm: { subjectOffering: { academicYear: { startDate: "desc" } } } }, { section: { sectionName: "asc" } }, { subjectOfferingTerm: { subjectOffering: { subjectCode: "asc" } } }, { subjectOfferingTerm: { academicTerm: { position: "asc" } } }, { id: "asc" }],
  });
}

export type SubjectAssignmentHistoryFilters = {
  q?: string;
  status?: "ACTIVE" | "ARCHIVED";
  academicYearId?: string;
  academicTermId?: string;
};

function getSubjectAssignmentHistoryWhere(
  filters: SubjectAssignmentHistoryFilters,
): Prisma.SubjectAssignmentWhereInput {
  const searchTerms = filters.q?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt:
      filters.status === "ACTIVE"
        ? null
        : filters.status === "ARCHIVED"
          ? { not: null }
          : undefined,
    academicTermId: filters.academicTermId,
    subjectOfferingTerm: {
      subjectOffering: {
        academicYearId: filters.academicYearId,
      },
    },
    AND: searchTerms.map((term) => ({
      OR: [
        { teacher: { employeeNumber: { contains: term, mode: "insensitive" } } },
        { teacher: { firstName: { contains: term, mode: "insensitive" } } },
        { teacher: { middleName: { contains: term, mode: "insensitive" } } },
        { teacher: { lastName: { contains: term, mode: "insensitive" } } },
        { section: { sectionName: { contains: term, mode: "insensitive" } } },
        { subjectOfferingTerm: { subjectOffering: { subjectCode: { contains: term, mode: "insensitive" } } } },
        { subjectOfferingTerm: { subjectOffering: { subjectDescription: { contains: term, mode: "insensitive" } } } },
        { subjectOfferingTerm: { subjectOffering: { academicYear: { label: { contains: term, mode: "insensitive" } } } } },
      ],
    })),
  };
}

const subjectAssignmentHistorySelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  teacher: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  section: { select: { id: true, sectionName: true, gradeLevel: true } },
  subjectOfferingTerm: {
    select: {
      academicTerm: { select: { id: true, name: true, position: true } },
      subjectOffering: {
        select: {
          id: true,
          subjectCode: true,
          subjectDescription: true,
          gradeLevel: true,
          academicYear: { select: { id: true, label: true } },
        },
      },
    },
  },
} satisfies Prisma.SubjectAssignmentSelect;

export function countSubjectAssignmentHistory(
  filters: SubjectAssignmentHistoryFilters,
  transaction?: Prisma.TransactionClient,
) {
  return client(transaction).subjectAssignment.count({
    where: getSubjectAssignmentHistoryWhere(filters),
  });
}

export function findSubjectAssignmentHistory(
  filters: SubjectAssignmentHistoryFilters,
  pagination: { skip: number; take: number },
  transaction?: Prisma.TransactionClient,
) {
  return client(transaction).subjectAssignment.findMany({
    where: getSubjectAssignmentHistoryWhere(filters),
    select: subjectAssignmentHistorySelect,
    skip: pagination.skip,
    take: pagination.take,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
}

export function findSubjectAssignmentHistoryFilterOptions(
  academicYearId?: string,
) {
  return Promise.all([
    prisma.academicYear.findMany({
      where: {
        subjectOfferings: {
          some: { terms: { some: { subjectAssignments: { some: {} } } } },
        },
      },
      select: { id: true, label: true },
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
    }),
    prisma.academicTerm.findMany({
      where: {
        academicYearId,
        subjectOfferings: { some: { subjectAssignments: { some: {} } } },
      },
      select: {
        id: true,
        name: true,
        position: true,
        academicYear: { select: { label: true } },
      },
      orderBy: [
        { academicYear: { startDate: "desc" } },
        { position: "asc" },
        { id: "asc" },
      ],
    }),
  ]);
}

export function findAcademicYearForAssignment(id: string, transaction?: Prisma.TransactionClient) {
  return client(transaction).academicYear.findUnique({ where: { id }, select: { id: true, label: true, status: true } }) as Promise<{ id: string; label: string; status: AcademicYearStatus } | null>;
}

export function findActiveAcademicYearsForMatrix(transaction?: Prisma.TransactionClient) {
  return client(transaction).academicYear.findMany({ where: { status: "ACTIVE" }, select: { id: true, label: true }, orderBy: [{ startDate: "desc" }, { id: "asc" }] });
}

export function findAssignmentMatrixScopes(academicYearId: string, gradeLevel: string, transaction?: Prisma.TransactionClient) {
  return client(transaction).subjectOfferingTerm.findMany({
    where: {
      subjectOffering: {
        academicYearId,
        gradeLevel,
        deletedAt: null,
        ...(gradeLevel === "11" ? { shsContext: { is: { curriculumStatus: "SCHOOL_APPROVED" } } } : {}),
      },
    },
    select: {
      subjectOfferingId: true,
      academicTermId: true,
      academicTerm: { select: { id: true, name: true, position: true, startDate: true } },
      subjectOffering: { select: { id: true, subjectCode: true, subjectDescription: true } },
    },
    orderBy: [{ subjectOffering: { subjectCode: "asc" } }, { academicTerm: { position: "asc" } }, { subjectOfferingId: "asc" }],
  });
}

export function findAssignmentMatrixSections(gradeLevel: string, transaction?: Prisma.TransactionClient) {
  return client(transaction).section.findMany({ where: { deletedAt: null, gradeLevel }, select: { id: true, sectionName: true, gradeLevel: true }, orderBy: [{ sectionName: "asc" }, { id: "asc" }] });
}

export function findAssignmentMatrixAssignments(subjectOfferingIds: string[], academicTermIds: string[], sectionIds: string[], transaction?: Prisma.TransactionClient) {
  if (!subjectOfferingIds.length || !academicTermIds.length || !sectionIds.length) return Promise.resolve([]);
  return client(transaction).subjectAssignment.findMany({
    where: { deletedAt: null, subjectOfferingId: { in: subjectOfferingIds }, academicTermId: { in: academicTermIds }, sectionId: { in: sectionIds } },
    select: { id: true, teacherId: true, subjectOfferingId: true, academicTermId: true, sectionId: true, teacher: { select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true } } },
  });
}

export function findAssignmentMatrixTeacherLoads(academicYearId: string, transaction?: Prisma.TransactionClient) {
  return client(transaction).subjectAssignment.findMany({
    where: { deletedAt: null, subjectOfferingTerm: { subjectOffering: { academicYearId } } },
    select: { teacherId: true, subjectOfferingId: true, academicTermId: true, sectionId: true, teacher: { select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true, status: true, deletedAt: true } } },
  });
}
