import { NextResponse, type NextRequest } from "next/server";

import { signOut } from "@/auth";

export async function POST(request: NextRequest) {
  await signOut({ redirect: false });

  return NextResponse.json(
    { redirectTo: new URL("/auth/login", request.url).pathname },
    { status: 200 },
  );
}
