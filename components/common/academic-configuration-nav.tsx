import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SegmentedNavigation } from "@/components/common/segmented-navigation";
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
    <SegmentedNavigation ariaLabel="Related academic configuration">
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
    </SegmentedNavigation>
  );
}
