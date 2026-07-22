"use client";

import { useSession, signOut } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { User, LogOut, ChevronsUpDown } from "lucide-react";
import { Separator } from "../ui/separator";

export function AppSidebarFooter() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  const initials =
    `${session.user.firstName?.[0] ?? ""}${session.user.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="flex flex-1 flex-col items-center">
            <span className="text-xs font-semibold">
              {session.user.firstName} {session.user.lastName}
            </span>

            <span className="text-xs text-muted-foreground">
              {session.user.role}
            </span>
          </div>

          <ChevronsUpDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <DropdownMenuItem>
            <User />
            Profile
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              signOut({
                redirectTo: "/auth/login",
              })
            }
          >
            <LogOut />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
