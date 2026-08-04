"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";

import { ChangePasswordDialog } from "@/components/account/change-password-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { User, LogOut, ChevronsUpDown, KeyRound } from "lucide-react";

interface AppSidebarFooterProps {
  variant?: "sidebar" | "navbar";
}

export function AppSidebarFooter({
  variant = "sidebar",
}: AppSidebarFooterProps) {
  const { data: session } = useSession();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  if (!session?.user) return null;

  const initials =
    `${session.user.firstName?.[0] ?? ""}${session.user.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open user menu"
          className={cn(
            "flex items-center rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            variant === "sidebar"
              ? "w-full gap-3 p-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
              : "w-auto max-w-48 gap-2 p-1.5",
          )}
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div
            className={cn(
              "min-w-0 flex-1 flex-col text-left",
              variant === "sidebar"
                ? "flex group-data-[collapsible=icon]:hidden"
                : "hidden sm:flex",
            )}
          >
            <span className="truncate text-xs font-semibold">
              {session.user.firstName} {session.user.lastName}
            </span>

            <span className="truncate text-[11px] text-muted-foreground">
              {session.user.role}
            </span>
          </div>

          <ChevronsUpDown
            className={cn(
              "size-4 shrink-0",
              variant === "sidebar" &&
                "group-data-[collapsible=icon]:hidden",
              variant === "navbar" && "hidden sm:block",
            )}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={variant === "sidebar" ? "top" : "bottom"}
          align="end"
        >
          <DropdownMenuItem>
            <User />
            Profile
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
            <KeyRound />
            Change Password
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
      {changePasswordOpen && (
        <ChangePasswordDialog
          open
          onOpenChange={setChangePasswordOpen}
        />
      )}
    </>
  );
}
