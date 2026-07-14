/**
 * Presentation metadata for recommendation categories and priorities
 * (CONTRACTS.md §6.4). Categories are the fixed rule-engine set; priorities
 * map onto the shared status colors. Kept local to the student feature.
 */
import {
  Award,
  BookOpen,
  Braces,
  Briefcase,
  FileText,
  GraduationCap,
  Mic,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { Priority } from "@/types";

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
}

/** Category → icon + human label. Falls back gracefully for unknown keys. */
const CATEGORY_META: Record<string, CategoryMeta> = {
  coding: { label: "Coding", icon: Braces },
  aptitude: { label: "Aptitude", icon: BookOpen },
  communication: { label: "Communication", icon: Presentation },
  resume: { label: "Resume", icon: FileText },
  academics: { label: "Academics", icon: GraduationCap },
  experience: { label: "Experience", icon: Briefcase },
  certification: { label: "Certification", icon: Award },
  interview: { label: "Interview", icon: Mic },
};

export function categoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_META[category] ?? {
      label: category
        ? category.charAt(0).toUpperCase() + category.slice(1)
        : "General",
      icon: Sparkles,
    }
  );
}

export interface PriorityMeta {
  label: string;
  /** Badge variant from the shared UI `Badge` component. */
  badgeVariant: "danger" | "warning" | "success";
  /** Left accent bar color class for timeline items. */
  accentClass: string;
}

/** Priority → badge variant + timeline accent (never color alone; label too). */
export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: {
    label: "High priority",
    badgeVariant: "danger",
    accentClass: "bg-red-500",
  },
  medium: {
    label: "Medium priority",
    badgeVariant: "warning",
    accentClass: "bg-amber-500",
  },
  low: {
    label: "Low priority",
    badgeVariant: "success",
    accentClass: "bg-green-500",
  },
};

/** Ordering for sorting recommendations / skill gaps by severity. */
export const PRIORITY_RANK: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
