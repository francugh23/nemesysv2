import { NextResponse, type NextRequest } from "next/server";

import { signOut } from "@/auth";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
};

function forbidden() {
  return NextResponse.json(
    { message: "Forbidden." },
    { status: 403, headers: noStoreHeaders },
  );
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const contentType = request.headers.get("content-type");
  const contentLength = request.headers.get("content-length");

  if (
    origin !== request.nextUrl.origin ||
    (fetchSite !== null && fetchSite !== "same-origin") ||
    contentType !== null ||
    (contentLength !== null && contentLength !== "0")
  ) {
    return forbidden();
  }

  if (request.body !== null && (await request.text()).length > 0) {
    return forbidden();
  }

  await signOut({ redirect: false });

  return NextResponse.json(
    { redirectTo: new URL("/auth/login", request.url).pathname },
    { status: 200, headers: noStoreHeaders },
  );
}
