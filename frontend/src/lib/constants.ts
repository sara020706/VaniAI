import {
  AlertTriangle,
  OctagonAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import type { Department, RiskLevel, Role } from "@/types";

/**
 * Human labels for ML feature names — mirrors
 * backend/ml/features/engineering.py::FEATURE_LABELS (CONTRACTS.md §6.1).
 * Used as a fallback when rendering explanation factors.
 */
export const FEATURE_LABELS: Record<string, string> = {
  cgpa: "CGPA",
  tenth_percentage: "10th Percentage",
  twelfth_percentage: "12th Percentage",
  attendance_percentage: "Attendance Percentage",
  coding_score: "Coding Score",
  aptitude_score: "Aptitude Score",
  communication_score: "Communication Score",
  technical_skill_score: "Technical Skill Score",
  leadership_score: "Leadership Score",
  internship_count: "Internship Count",
  project_count: "Project Count",
  certification_count: "Certification Count",
  hackathon_count: "Hackathon Count",
  resume_score: "Resume Score",
  mock_interview_score: "Mock Interview Score",
  academic_index: "Academic Index",
  skill_index: "Skill Index",
  experience_index: "Experience Index",
};

/** Resolve a feature name to its human label. */
export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

export const DEPARTMENTS: Department[] = [
  "CSE",
  "IT",
  "ECE",
  "EEE",
  "MECH",
  "CIVIL",
];

/** Batches available in seed data; useful for filter dropdowns. */
export const BATCHES: string[] = ["2024", "2025", "2026", "2027"];

export interface RiskLevelMeta {
  /** Literal API value. */
  value: RiskLevel;
  /** Display label. */
  label: string;
  /** Lucide icon — risk is never communicated by color alone. */
  icon: LucideIcon;
  /** Status hex color (chart/status usage). */
  color: string;
  /** Tailwind classes for badge-style rendering (light + dark). */
  badgeClass: string;
}

/** Risk → status mapping: low→good, medium→warning, high→critical. */
export const RISK_LEVELS: Record<RiskLevel, RiskLevelMeta> = {
  low: {
    value: "low",
    label: "Low Risk",
    icon: ShieldCheck,
    color: "#0ca30c",
    badgeClass:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900",
  },
  medium: {
    value: "medium",
    label: "Medium Risk",
    icon: AlertTriangle,
    color: "#fab219",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  },
  high: {
    value: "high",
    label: "High Risk",
    icon: OctagonAlert,
    color: "#d03b3b",
    badgeClass:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
  },
};

export const RISK_LEVEL_ORDER: RiskLevel[] = ["low", "medium", "high"];

/** Role → landing route after login. */
export const ROLE_HOME_ROUTES: Record<Role, string> = {
  student: "/student",
  faculty: "/faculty",
  placement_officer: "/placement",
  admin: "/admin",
};

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty",
  placement_officer: "Placement Officer",
  admin: "Administrator",
};

/** Demo accounts created by backend/scripts/seed.py (CONTRACTS.md §10). */
export interface DemoAccount {
  role: Role;
  email: string;
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "admin", email: "admin@vaniai.io", password: "Admin@123" },
  { role: "faculty", email: "faculty@vaniai.io", password: "Faculty@123" },
  {
    role: "placement_officer",
    email: "placement@vaniai.io",
    password: "Placement@123",
  },
  { role: "student", email: "student@vaniai.io", password: "Student@123" },
];
