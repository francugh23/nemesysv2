import { redirect } from "next/navigation";

import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/lib/authorization";
import { INVALID_SESSION_ROUTE } from "@/routes";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect(INVALID_SESSION_ROUTE);
    }

    throw error;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
