import { NextResponse } from "next/server";

import { AuthorizationError, requireRole } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { finalizeCurriculumService } from "@/services/curriculum-finalization.service";
import { promoteShsSubjectOfferingService } from "@/services/subject-offering.service";

const confirmation = "PHASE_22D_APPROVE_AND_FINALIZE_SY_2026_2027";
const codes = ["SSHS-G11-CORE-01", "SSHS-G11-CORE-02", "SSHS-G11-CORE-03", "SSHS-G11-CORE-04", "SSHS-G11-CORE-05", "SSHS-G11-ACA-ASSH-01", "SSHS-G11-ACA-ASSH-02", "SSHS-G11-TP-CADT-01"];

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== "development") throw new Error("Phase 22D continuation is available only in development.");
    await requireRole("SUPER_ADMIN");
    const body = await request.json() as { confirmation?: string; approvalReferences?: Record<string, string> };
    if (body.confirmation !== confirmation) return NextResponse.json({ message: "Typed confirmation is required." }, { status: 400 });
    if (!body.approvalReferences || codes.some((code) => !body.approvalReferences![code]?.trim() || /demo-bot|test|sample|^n\/a$/i.test(body.approvalReferences![code]))) {
      return NextResponse.json({ message: "A legitimate non-placeholder approval reference is required for every SHS Offering." }, { status: 400 });
    }
    const year = await prisma.academicYear.findFirst({ where: { label: "2026-2027", status: "ACTIVE" }, select: { id: true } });
    if (!year) throw new Error("Active SY 2026-2027 is required.");
    const offerings = await prisma.subjectOffering.findMany({ where: { academicYearId: year.id, deletedAt: null, subjectCode: { in: codes }, shsContext: { curriculumStatus: "PROVISIONAL_DEPED" } }, select: { id: true, subjectCode: true } });
    if (offerings.length !== codes.length) throw new Error("Exactly eight pending Phase 22D SHS Offerings are required.");
    for (const offering of offerings) await promoteShsSubjectOfferingService({ subjectOfferingId: offering.id, approvalReference: body.approvalReferences[offering.subjectCode] });
    const [pending, approved, policies] = await Promise.all([
      prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null, gradeLevel: { in: ["11", "12"] }, shsContext: { curriculumStatus: "PROVISIONAL_DEPED" } } }),
      prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null, gradeLevel: { in: ["11", "12"] }, shsContext: { curriculumStatus: "SCHOOL_APPROVED" } } }),
      prisma.shsElectiveEnrollmentPolicy.count({ where: { academicYearId: year.id } }),
    ]);
    if (pending || approved !== 8 || policies !== 6) throw new Error("SHS approval or elective-policy readiness is incomplete.");
    await finalizeCurriculumService(year.id);
    return NextResponse.json({ academicYearId: year.id, finalized: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
