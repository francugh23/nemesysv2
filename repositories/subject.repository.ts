import prisma from "@/lib/prisma";

export async function findSubjects() {
  return prisma.subject.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      description: true,
      gradeLevel: true,
      trackStrand: true,
      semester: true,
    },
    orderBy: [
      {
        gradeLevel: "asc",
      },
      {
        code: "asc",
      },
      {
        trackStrand: "asc",
      },
    ],
  });
}
