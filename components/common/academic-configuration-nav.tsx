import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ACADEMIC_CONFIGURATION_LINKS } from "@/lib/academic-configuration";
import { cn } from "@/lib/utils";

export function AcademicConfigurationNav({
  current,
  showSubjects = true,
}: {
  current: (typeof ACADEMIC_CONFIGURATION_LINKS)[number]["title"];
  showSubjects?: boolean;
}) {
  return (
    <nav
      aria-label="Related academic configuration"
      className="flex w-fit flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
    >
      {ACADEMIC_CONFIGURATION_LINKS.filter(
        (item) => showSubjects || item.title !== "Subjects",
      ).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.title === current ? "page" : undefined}
          className={cn(
            buttonVariants({
              variant: item.title === current ? "secondary" : "ghost",
              size: "sm",
            }),
          )}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
