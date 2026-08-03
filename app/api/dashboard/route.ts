import { NextResponse } from "next/server";
import {
  AuthorizationError,
  Permissions,
  requirePermission,
} from "@/lib/authorization";
import { getDashboardData } from "@/services/dashboard.service";

export async function GET() {
  try {
    await requirePermission(Permissions.DASHBOARD);

    const data = await getDashboardData();

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
