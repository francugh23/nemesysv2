import prisma from "@/lib/prisma";

export async function findTeachers() {
  return prisma.teacher.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      degree: true,
      major: true,
      isAdviser: true,
      user: {
        select: {
          employeeNumber: true,
          username: true,
          email: true,
          firstName: true,
          middleName: true,
          lastName: true,
          gender: true,
          status: true,
        },
      },
    },
    orderBy: [
      {
        user: {
          lastName: "asc",
        },
      },
      {
        user: {
          firstName: "asc",
        },
      },
    ],
  });
}
