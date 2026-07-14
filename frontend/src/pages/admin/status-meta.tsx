/**
 * Local presentational helpers shared across the admin console pages:
 * dataset / experiment status pills, model-metric formatting, and a small
 * status dot. These are admin-only sub-components (no cross-feature reuse).
 */
import {
  CheckCircle2,
  CircleSlash,
  Clock,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DatasetStatus, ExperimentStatus } from "@/types";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "outline";

interface StatusMeta {
  label: string;
  variant: BadgeVariant;
  icon: LucideIcon;
  spin?: boolean;
}

const DATASET_STATUS_META: Record<DatasetStatus, StatusMeta> = {
  uploaded: { label: "Uploaded", variant: "secondary", icon: Clock },
  validated: { label: "Validated", variant: "success", icon: CheckCircle2 },
  invalid: { label: "Invalid", variant: "danger", icon: XCircle },
  used: { label: "Used", variant: "default", icon: CheckCircle2 },
};

const EXPERIMENT_STATUS_META: Record<ExperimentStatus, StatusMeta> = {
  running: { label: "Running", variant: "warning", icon: Loader2, spin: true },
  completed: { label: "Completed", variant: "success", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "danger", icon: XCircle },
};

function StatusPill({ meta }: { meta: StatusMeta }) {
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className="capitalize">
      <Icon className={cn(meta.spin && "animate-spin")} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

/** Colored status pill for dataset rows. */
export function DatasetStatusBadge({ status }: { status: DatasetStatus }) {
  return <StatusPill meta={DATASET_STATUS_META[status]} />;
}

/** Colored status pill for experiment rows (spinner while running). */
export function ExperimentStatusBadge({ status }: { status: ExperimentStatus }) {
  return <StatusPill meta={EXPERIMENT_STATUS_META[status]} />;
}

/** Small round status dot — green when healthy, red otherwise. */
export function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        ok ? "bg-green-500" : "bg-red-500",
      )}
      aria-hidden="true"
    />
  );
}

/** A CircleSlash icon used when a metric value is unavailable. */
export const UnavailableIcon = CircleSlash;

const METRIC_LABELS: Record<string, string> = {
  accuracy: "Accuracy",
  precision: "Precision",
  recall: "Recall",
  f1: "F1 Score",
  roc_auc: "ROC AUC",
};

/** Human label for an ML metric key. */
export function metricLabel(key: string): string {
  return (
    METRIC_LABELS[key] ??
    key
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

/**
 * Format a 0–1 metric value as a percentage string. Returns "—" for
 * missing / non-finite values.
 */
export function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}
