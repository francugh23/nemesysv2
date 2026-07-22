"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

function formatPageTitle(pathname: string) {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("("));

  if (segments.length === 0) {
    return "Dashboard";
  }

  const last = segments[segments.length - 1];

  return last
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const pageTitle = useMemo(() => formatPageTitle(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />

        <Separator orientation="vertical" className="h-6" />

        <h1 className="text-xl font-semibold tracking-tight">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Welcome,</span>

        <span className="font-semibold">{session?.user?.firstName}</span>
      </div>
    </header>
  );
}