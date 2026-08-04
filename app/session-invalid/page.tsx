"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function InvalidSessionPage() {
  useEffect(() => {
    async function clearSession() {
      const response = await fetch("/api/auth/session-invalid", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);

      if (!response?.ok) {
        await signOut({ redirect: false }).catch(() => undefined);
      }

      window.location.replace("/auth/login");
    }

    void clearSession();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">
        Your session has changed. Returning to sign in...
      </p>
    </main>
  );
}
