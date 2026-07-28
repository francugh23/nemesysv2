import prisma from "@/lib/prisma";

export async function findAllSubjectAssignments() {
  return prisma.subjectAssignment.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      teacherId: true,
      subjectId: true,
      sectionId: true,
      academicYear: true,
      teacher: {
        select: {
          user: {
            select: {
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      },
      subject: {
        select: {
          code: true,
          description: true,
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
        section: {
          sectionName: "asc",
        },
      },
      {
        subject: {
          code: "asc",
        },
      },
      {
        teacher: {
          user: {
            lastName: "asc",
          },
        },
      },
      {
        teacher: {
          user: {
            firstName: "asc",
          },
        },
      },
    ],
  });
}
