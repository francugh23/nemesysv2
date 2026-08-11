import { CURRICULUM_ROUTE, CURRICULUM_TITLE } from "@/lib/academic-configuration";

const routeTitles: Record<string, string> = {
  [CURRICULUM_ROUTE]: CURRICULUM_TITLE,
};

export function formatPageTitle(pathname: string) {
  const routeTitle = routeTitles[pathname];

  if (routeTitle) {
    return routeTitle;
  }

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("("));

  if (segments.length === 0) {
    return "Dashboard";
  }

  return segments[segments.length - 1]
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
