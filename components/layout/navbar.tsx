"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const pageTitle = formatPageTitle(pathname);
  const isDashboard = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SidebarTrigger aria-label="Toggle navigation" className="shrink-0" />

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="hidden sm:block">
            <ol className="flex items-center gap-1 text-xs text-muted-foreground">
              <li>
                {isDashboard ? (
                  <span aria-current="page">Dashboard</span>
                ) : (
                  <Link href="/dashboard" className="hover:text-foreground">
                    Dashboard
                  </Link>
                )}
              </li>
              {!isDashboard && (
                <>
                  <li aria-hidden="true">
                    <ChevronRight className="size-3" />
                  </li>
                  <li className="truncate" aria-current="page">
                    {pageTitle}
                  </li>
                </>
              )}
            </ol>
          </nav>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled
          aria-label="Notifications, coming soon"
          title="Notifications coming soon"
        >
          <Bell />
        </Button>
      </div>
    </header>
  );
}
