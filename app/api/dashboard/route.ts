import { NextResponse } from "next/server";
import { getDashboardData } from "@/services/dashboard.service";

export async function GET() {
  try {
    const data = await getDashboardData();

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}