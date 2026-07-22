"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { usePathname } from "next/navigation";
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
} from "@/components/ui/sidebar";

import { Separator } from "@/components/ui/separator";

import { navigation } from "./navigation";
import { AppSidebarFooter } from "./app-sidebar-footer";
import { Button } from "../ui/button";

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();

  if (!session?.user) return null;

  const items = navigation[session.user.role];

  return (
    <Sidebar>
      <SidebarHeader className="bg-white">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="h-auto w-full flex-col gap-2 px-4 py-5"
        >
          <Image src="/nvg-logo.png" alt="NEMESYS" width={60} height={60} />

          <div className="text-center">
            <h1 className="text-xl font-bold">NEMESYS</h1>

            <p className="text-xs text-muted-foreground">
              Enrollment Management System
            </p>
          </div>
        </Button>
        <Separator />
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
                        onClick={() => router.push(item.href)}
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
        <p className="py-2 text-center text-[10px] text-muted-foreground">
          v2.0.0.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
