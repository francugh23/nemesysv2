import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { SessionProvider } from "next-auth/react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Navbar } from "@/components/layout/navbar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <SessionProvider session={session}>
      <SidebarProvider>
        <AppSidebar />

        <SidebarInset>
          {/* <Navbar /> */}

          <main className="p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}