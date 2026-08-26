import { NextResponse } from "next/server";
import { AuthorizationError, Permissions, requirePermission } from "@/lib/authorization";
import { getOperationalDashboard } from "@/services/dashboard.service";

export async function GET() {
  try {
    await requirePermission(Permissions.OPERATIONAL_DASHBOARD);
    return NextResponse.json(await getOperationalDashboard(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
