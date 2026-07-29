import { auth } from "@/auth";
import { findActiveSections } from "@/repositories/section.repository";
import type { SectionListItem } from "@/schemas";

export async function getSections(): Promise<SectionListItem[]> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }

  const sections = await findActiveSections();

  return sections.map((section) => ({
    id: section.id,
    gradeLevel: section.gradeLevel,
    trackStrand: section.trackStrand,
    sectionName: section.sectionName,
    adviserFirstName: section.adviser?.user.firstName ?? null,
    adviserMiddleName: section.adviser?.user.middleName ?? null,
    adviserLastName: section.adviser?.user.lastName ?? null,
    room: section.room,
    shift: section.shift,
  }));
}
