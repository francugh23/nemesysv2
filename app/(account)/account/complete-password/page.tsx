import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes";

export default async function CompletePasswordPage() {
  const session = await requireAuthenticatedUser();

  if (!session.user.isFirstLogin) {
    redirect(DEFAULT_LOGIN_REDIRECT(session.user.role));
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-primary">Account setup</p>
        <CardTitle>Choose your permanent password</CardTitle>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm firstLogin />
      </CardContent>
    </Card>
  );
}
