import prisma from "@/lib/prisma";

export async function getDashboardCounts() {
  const [students, teachers, sections, subjects] = await Promise.all([
    prisma.student.count({
      where: {
        deletedAt: null,
      },
    }),

    prisma.teacher.count({
      where: {
        deletedAt: null,
      },
    }),

    prisma.section.count({
      where: {
        deletedAt: null,
      },
    }),

    prisma.subject.count({
      where: {
        deletedAt: null,
      },
    }),
  ]);

  return {
    students,
    teachers,
    sections,
    subjects,
  };
}