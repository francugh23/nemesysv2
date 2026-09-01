import { NextResponse } from "next/server";

import { AuthorizationError, requireRole } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { finalizeCurriculumService } from "@/services/curriculum-finalization.service";

const confirmation = "PHASE_22D_FINALIZE_CURRICULUM_2026_2027";

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== "development") throw new Error("Phase 22D finalization is available only in development.");
    await requireRole("SUPER_ADMIN");
    const body = await request.json() as { confirmation?: string };
    if (body.confirmation !== confirmation) return NextResponse.json({ message: "Typed confirmation is required." }, { status: 400 });

    const year = await prisma.academicYear.findFirst({ where: { label: "2026-2027", status: "ACTIVE" }, select: { id: true } });
    if (!year) throw new Error("Active SY 2026-2027 is required.");
    const [approved, provisional, policies, finalizations] = await Promise.all([
      prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null, gradeLevel: { in: ["11", "12"] }, shsContext: { curriculumStatus: "SCHOOL_APPROVED" } } }),
      prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null, gradeLevel: { in: ["11", "12"] }, shsContext: { curriculumStatus: "PROVISIONAL_DEPED" } } }),
      prisma.shsElectiveEnrollmentPolicy.count({ where: { academicYearId: year.id } }),
      prisma.curriculumFinalization.count({ where: { academicYearId: year.id } }),
    ]);
    if (approved !== 8 || provisional || policies !== 6 || finalizations) throw new Error("Phase 22D-B1 finalization preconditions are not met.");
    await finalizeCurriculumService(year.id);
    return NextResponse.json({ academicYearId: year.id, finalized: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
