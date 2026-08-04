"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { Separator } from "@/components/ui/separator";

import { navigation } from "./navigation";
import { AppSidebarFooter } from "./app-sidebar-footer";
import { Button } from "../ui/button";

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  if (!session?.user) return null;

  const items = navigation[session.user.role];

  function navigate(href: string) {
    if (isMobile) {
      setOpenMobile(false);
    }

    router.push(href);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b pr-10 lg:pr-2">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          aria-label="Go to dashboard"
          className="h-12 w-full justify-start gap-3 overflow-hidden px-2 py-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
        >
          <Image
            src="/nvg-logo.png"
            alt="NEMESYS logo"
            width={40}
            height={40}
            className="size-10 shrink-0 group-data-[collapsible=icon]:size-8"
          />

          <div className="min-w-0 text-left group-data-[collapsible=icon]:hidden">
            <h1 className="truncate text-base font-bold">NEMESYS</h1>

            <p className="truncate text-[11px] text-muted-foreground">
              Enrollment Management System
            </p>
          </div>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        {items.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={pathname === item.href}
                        tooltip={item.title}
                        aria-current={pathname === item.href ? "page" : undefined}
                        onClick={() => navigate(item.href)}
                      >
                        <Icon className="size-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <AppSidebarFooter />
        <Separator />
        <p className="py-2 text-center text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          v2.0.0.0
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
