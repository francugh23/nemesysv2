import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { SessionProvider } from "next-auth/react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/lib/authorization";
import { COMPLETE_PASSWORD_ROUTE, INVALID_SESSION_ROUTE } from "@/routes";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;

  try {
    session = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect(INVALID_SESSION_ROUTE);
    }

    throw error;
  }

  if (session.user.isFirstLogin) {
    redirect(COMPLETE_PASSWORD_ROUTE);
  }

  const cookieStore = await cookies();
  const sidebarDefaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SessionProvider session={session}>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar />

        <SidebarInset>
          <Navbar />
          <div className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
