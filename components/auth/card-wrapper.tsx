"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Header } from "./header";

interface CardWrapperProps {
  children?: React.ReactNode;
  headerLabel: string;
  backButtonLabel: string;
  backButtonHref: string;
  showSocial?: boolean;
}

export const CardWrapper = ({ children, headerLabel }: CardWrapperProps) => {
  return (
    <Card
      className="
        w-full
        max-w-md
        rounded-3xl
        border
        border-white/30
        bg-white
        backdrop-blur-xl
        shadow-2xl
        animate-in
        fade-in
        slide-in-from-right-8
        duration-700
      "
    >
      <CardHeader className="pt-8">
        <Header label={headerLabel} />
      </CardHeader>

      <CardContent className="px-8 pb-8">{children}</CardContent>
    </Card>
  );
};
