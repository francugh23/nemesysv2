import { NextResponse } from "next/server";

import { AuthorizationError, requireRole } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createSubjectService } from "@/services/subject.service";

const confirmation = "PHASE_22D_CREATE_G12_WORK_IMMERSION";
const code = "SSHS-G12-WORK-IMMERSION";

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== "development") throw new Error("Phase 22D Work Immersion setup is available only in development.");
    await requireRole("SUPER_ADMIN");
    const body = await request.json() as { confirmation?: string };
    if (body.confirmation !== confirmation) return NextResponse.json({ message: "Typed confirmation is required." }, { status: 400 });
    const [subjectCount, existing, grade12Offerings] = await Promise.all([
      prisma.subject.count({ where: { deletedAt: null } }),
      prisma.subject.findFirst({ where: { code, gradeLevel: "12", deletedAt: null }, select: { id: true } }),
      prisma.subjectOffering.count({ where: { gradeLevel: "12", deletedAt: null } }),
    ]);
    if (subjectCount !== 53 || existing || grade12Offerings) throw new Error("Phase 22D Work Immersion preconditions are not met.");
    const subject = await createSubjectService({ code, description: "Work Immersion", gradeLevel: "12" });
    return NextResponse.json({ subject }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
