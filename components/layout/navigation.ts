import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UserCog,
  School,
  BookOpen,
  BookCopy,
  ClipboardCheck,
  UserPlus,
  FileText,
  Shield,
  ScrollText,
  Settings,
  CalendarRange,
  Layers,
  LucideIcon,
} from "lucide-react";

import { UserRole } from "@/app/generated/prisma/enums";
import {
  CURRICULUM_ROUTE,
  CURRICULUM_TITLE,
} from "@/lib/academic-configuration";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export const navigation = {
  SUPER_ADMIN: [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },

    {
      title: "People",
      items: [
        {
          title: "Students",
          href: "/dashboard/students",
          icon: GraduationCap,
        },
        {
          title: "Teachers",
          href: "/dashboard/teachers",
          icon: Users,
        },
        {
          title: "Users",
          href: "/dashboard/users",
          icon: UserCog,
        },
      ],
    },

    {
      title: "Academic Configuration",
      items: [
        {
          title: "Academic Years",
          href: "/dashboard/academic-years",
          icon: CalendarRange,
        },
        {
          title: "Subjects",
          href: "/dashboard/subjects",
          icon: BookOpen,
        },
        {
          title: CURRICULUM_TITLE,
          href: CURRICULUM_ROUTE,
          icon: Layers,
        },
      ],
    },

    {
      title: "Academics",
      items: [
        {
          title: "Sections",
          href: "/dashboard/sections",
          icon: School,
        },
        {
          title: "Assignments",
          href: "/dashboard/assignments",
          icon: BookCopy,
        },
      ],
    },

    {
      title: "Operations",
      items: [
        {
          title: "Registration",
          href: "/dashboard/registration",
          icon: UserPlus,
        },
        {
          title: "Enrollment",
          href: "/dashboard/enrollment",
          icon: ClipboardCheck,
        },
      ],
    },

    {
      title: "Reports",
      items: [
        {
          title: "Reports",
          href: "/dashboard/reports",
          icon: FileText,
        },
      ],
    },

    {
      title: "Administration",
      items: [
        {
          title: "Audit Logs",
          href: "/dashboard/audit-logs",
          icon: ScrollText,
        },
        {
          title: "System",
          href: "/dashboard/system",
          icon: Shield,
        },
        {
          title: "Settings",
          href: "/dashboard/settings",
          icon: Settings,
        },
      ],
    },
  ],

  REGISTRAR: [
    {
      title: "Academic Configuration",
      items: [
        {
          title: "Academic Years",
          href: "/dashboard/academic-years",
          icon: CalendarRange,
        },
        {
          title: CURRICULUM_TITLE,
          href: CURRICULUM_ROUTE,
          icon: Layers,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          title: "Enrollment",
          href: "/dashboard/enrollment",
          icon: ClipboardCheck,
        },
      ],
    },
  ],

  PRINCIPAL: [],

  TEACHER: [],
} satisfies Record<UserRole, NavigationGroup[]>;
