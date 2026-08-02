import prisma from "@/lib/prisma";

export async function findNonArchivedEnrollments() {
  return prisma.enrollment.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      studentId: true,
      sectionId: true,
      academicYear: true,
      semester: true,
      status: true,
      student: {
        select: {
          lrn: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      },
      section: {
        select: {
          gradeLevel: true,
          trackStrand: true,
          sectionName: true,
        },
      },
    },
    orderBy: [
      {
        academicYear: "desc",
      },
      {
        student: {
          lastName: "asc",
        },
      },
      {
        student: {
          firstName: "asc",
        },
      },
      {
        student: {
          lrn: "asc",
        },
      },
    ],
  });
}
