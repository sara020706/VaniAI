import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Loader2,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { adminApi } from "@/lib/api";

import {
  DataTable,
  ErrorState,
  LoadingState,
  PageHeader,
  type DataTableColumn,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime, getApiErrorMessage } from "@/lib/utils";
import type {
  DataDriftResult,
  DriftHistoryItem,
  PredictionDriftResult,
} from "@/types";

import { adminKeys, useDrift } from "@/pages/admin/use-admin";

// External MLOps dashboards (host ports per CONTRACTS.md §3).
const EXTERNAL_LINKS: { name: string; description: string; href: string }[] = [
  {
    name: "Grafana",
    description: "System metrics, request rate & drift gauges",
    href: "http://localhost:3001",
  },
  {
    name: "MLflow",
    description: "Experiment tracking & model registry",
    href: "http://localhost:5000",
  },
];

const DRIFT_METRIC_LABELS: Record<DriftHistoryItem["metric_type"], string> = {
  data_drift: "Data drift",
  prediction_drift: "Prediction drift",
  system: "System",
};

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
const listItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

/** Semantic severity for the drifted-feature share (higher share = worse). */
type Severity = "calm" | "watch" | "elevated" | "high";

function shareSeverity(share: number): Severity {
  if (share >= 0.5) return "high";
  if (share >= 0.25) return "elevated";
  if (share > 0) return "watch";
  return "calm";
}

/** Token-driven colour for each severity band (no raw hex, theme-aware). */
const SEVERITY_STROKE: Record<Severity, string> = {
  calm: "text-success",
  watch: "text-warning",
  elevated: "text-warning",
  high: "text-destructive",
};
const SEVERITY_LABEL: Record<Severity, string> = {
  calm: "Within range",
  watch: "Minor shift",
  elevated: "Watch closely",
  high: "Significant drift",
};

/**
 * Signature instrument: an animated arc gauge for the share of features that
 * have drifted. Sweeps a 240° track and fills proportionally on mount.
 */
function DriftGauge({ share }: { share: number }) {
  const clamped = Math.min(1, Math.max(0, share));
  const pct = Math.round(clamped * 100);
  const severity = shareSeverity(clamped);

  // Geometry for a 240° open-bottom arc.
  const size = 148;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const sweep = 240; // degrees of visible track
  const startAngle = 150; // bottom-left
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweep / 360) * circumference;
  const gap = circumference - arcLength;

  const polar = (angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };
  const start = polar(startAngle);

  return (
    <div className="relative mx-auto w-fit">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={`${pct}% of features drifted — ${SEVERITY_LABEL[severity]}`}
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-muted"
          strokeDasharray={`${arcLength} ${gap}`}
          transform={`rotate(${startAngle - 180} ${cx} ${cy})`}
        />
        {/* Filled progress arc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn(SEVERITY_STROKE[severity], "transition-colors")}
          stroke="currentColor"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${startAngle - 180} ${cx} ${cy})`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: arcLength - arcLength * clamped }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {/* endpoint dot for a needle-like read */}
        <circle cx={start.x} cy={start.y} r={2.5} className="fill-muted-foreground/40" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">
          {pct}
          <span className="text-lg font-semibold text-muted-foreground">%</span>
        </span>
        <span className="mt-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
          drifted
        </span>
      </div>
    </div>
  );
}

function DataDriftCard({ drift }: { drift: DataDriftResult | null }) {
  const share = drift ? drift.share_drifted : 0;
  const severity = shareSeverity(Math.min(1, Math.max(0, share)));

  return (
    <div className="gradient-border h-full p-[1px]">
      <div className="flex h-full flex-col gap-5 rounded-3xl bg-card p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Input distribution
            </p>
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
              <BarChart3 className="h-5 w-5 text-electric" aria-hidden="true" />
              Data drift
            </h2>
          </div>
          {drift ? (
            <Badge variant={drift.data_drift_detected ? "danger" : "success"}>
              {drift.data_drift_detected ? "Drift detected" : "Stable"}
            </Badge>
          ) : (
            <Badge variant="secondary">Not checked</Badge>
          )}
        </div>

        {drift ? (
          <div className="flex flex-1 flex-col gap-5">
            <DriftGauge share={share} />

            <p
              className={cn(
                "text-center text-sm font-medium",
                SEVERITY_STROKE[severity],
              )}
            >
              {SEVERITY_LABEL[severity]}
            </p>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Drifted features
              </p>
              {drift.drifted_features.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None — all features within range.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {drift.drifted_features.map((feature) => (
                    <Badge key={feature} variant="warning">
                      {feature}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-auto text-xs text-muted-foreground">
              Last checked {formatDateTime(drift.checked_at)}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="grid-backdrop flex h-14 w-14 items-center justify-center rounded-full border border-border/60">
              <BarChart3 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              No data-drift report yet. Run a check to compare recent prediction
              inputs against the training baseline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PredictionDriftCard({
  drift,
}: {
  drift: PredictionDriftResult | null;
}) {
  return (
    <div className="gradient-border h-full p-[1px]">
      <div className="flex h-full flex-col gap-5 rounded-3xl bg-card p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Output distribution
            </p>
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
              <Activity className="h-5 w-5 text-electric" aria-hidden="true" />
              Prediction drift
            </h2>
          </div>
          {drift ? (
            <Badge variant={drift.drift_detected ? "danger" : "success"}>
              {drift.drift_detected ? "Drift detected" : "Stable"}
            </Badge>
          ) : (
            <Badge variant="secondary">Not checked</Badge>
          )}
        </div>

        {drift ? (
          <div className="flex flex-1 flex-col gap-5">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-5 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Population Stability Index
              </p>
              <motion.p
                className={cn(
                  "mt-2 text-5xl font-bold tabular-nums",
                  drift.drift_detected ? "text-destructive" : "text-success",
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {drift.psi.toFixed(3)}
              </motion.p>
              <p className="mt-2 text-xs text-muted-foreground">
                Threshold 0.20
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              PSI above the 0.20 threshold signals a distribution shift in the
              model&apos;s predicted probabilities.
            </p>

            <p className="mt-auto text-xs text-muted-foreground">
              Last checked {formatDateTime(drift.checked_at)}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="grid-backdrop flex h-14 w-14 items-center justify-center rounded-full border border-border/60">
              <Activity className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              No prediction-drift report yet. PSI is computed once enough recent
              predictions exist.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminMonitoringPage() {
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: () => adminApi.runDrift(),
    onSuccess: (result) => {
      queryClient.setQueryData(adminKeys.drift(), result);
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success("Drift check complete.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not run the drift check."));
    },
  });

  // Poll while a drift check is in flight so newly-persisted results appear.
  const drift = useDrift(runMutation.isPending);

  const dataDrift = drift.data?.data_drift ?? null;
  const predictionDrift = drift.data?.prediction_drift ?? null;
  const historyItems: DriftHistoryItem[] = drift.data?.history ?? [];

  const historyColumns: DataTableColumn<DriftHistoryItem>[] = [
    {
      key: "metric_type",
      header: "Check",
      render: (row) => DRIFT_METRIC_LABELS[row.metric_type],
    },
    {
      key: "drift_detected",
      header: "Result",
      render: (row) =>
        row.drift_detected ? (
          <Badge variant="danger">Drift detected</Badge>
        ) : (
          <Badge variant="success">
            <CheckCircle2 aria-hidden="true" />
            Stable
          </Badge>
        ),
    },
    {
      key: "created_at",
      header: "Checked at",
      className: "tabular-nums",
      render: (row) => formatDateTime(row.created_at),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Monitoring"
        description="Data & prediction drift against the training baseline, with links to the MLOps stack."
        actions={
          <Button
            variant="gradient"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Run drift check now
          </Button>
        }
      />

      {drift.isLoading ? (
        <LoadingState label="Loading drift status…" />
      ) : drift.isError ? (
        <ErrorState
          title="Could not load drift status"
          onRetry={() => void drift.refetch()}
        />
      ) : (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          <section className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Drift instruments
              </p>
              <h2 className="text-lg font-bold tracking-tight">
                Are recent predictions still in-distribution?
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <motion.div
                variants={listItem}
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="transition-shadow hover:drop-shadow-[0_12px_28px_hsl(var(--primary)/0.12)]"
              >
                <DataDriftCard drift={dataDrift} />
              </motion.div>
              <motion.div
                variants={listItem}
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="transition-shadow hover:drop-shadow-[0_12px_28px_hsl(var(--primary)/0.12)]"
              >
                <PredictionDriftCard drift={predictionDrift} />
              </motion.div>
            </div>
          </section>

          {/* Monitoring history --------------------------------------------- */}
          <motion.section variants={listItem} className="space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Monitoring history
              </p>
            </div>
            <div className="surface-card p-5">
              <DataTable
                columns={historyColumns}
                data={historyItems}
                rowKey={(row) => row.id}
                emptyMessage="No drift checks recorded yet"
                className={cn(drift.isFetching && "opacity-70")}
              />
            </div>
          </motion.section>
        </motion.div>
      )}

      {/* External MLOps dashboards ------------------------------------------ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            MLOps dashboards
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="surface-card group flex items-center justify-between gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[var(--shadow-lg)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <RadioTower className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{link.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </div>
              <ExternalLink
                className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
