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
  GlassCard,
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

/** Meter colour by drifted-feature share (higher share ⇒ more severe). */
function shareSeverityClass(share: number): string {
  if (share >= 0.5) return "bg-red-500";
  if (share >= 0.25) return "bg-amber-500";
  if (share > 0) return "bg-yellow-400";
  return "bg-green-500";
}

function DataDriftCard({ drift }: { drift: DataDriftResult | null }) {
  const share = drift ? drift.share_drifted : 0;
  const sharePct = Math.round(Math.min(1, Math.max(0, share)) * 100);

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
          Data drift
        </h2>
        {drift ? (
          <Badge variant={drift.data_drift_detected ? "danger" : "success"}>
            {drift.data_drift_detected ? "Drift detected" : "Stable"}
          </Badge>
        ) : (
          <Badge variant="secondary">Not checked</Badge>
        )}
      </div>

      {drift ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Features drifted</span>
              <span className="font-semibold tabular-nums">{sharePct}%</span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={sharePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Share of features drifted"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  shareSeverityClass(share),
                )}
                style={{ width: `${sharePct}%` }}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Drifted features
            </p>
            {drift.drifted_features.length === 0 ? (
              <p className="text-sm">None — all features within range.</p>
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

          <p className="text-xs text-muted-foreground">
            Last checked {formatDateTime(drift.checked_at)}
          </p>
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          No data-drift report yet. Run a check to compare recent prediction
          inputs against the training baseline.
        </p>
      )}
    </GlassCard>
  );
}

function PredictionDriftCard({
  drift,
}: {
  drift: PredictionDriftResult | null;
}) {
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          Prediction drift
        </h2>
        {drift ? (
          <Badge variant={drift.drift_detected ? "danger" : "success"}>
            {drift.drift_detected ? "Drift detected" : "Stable"}
          </Badge>
        ) : (
          <Badge variant="secondary">Not checked</Badge>
        )}
      </div>

      {drift ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Population Stability Index (PSI)
            </p>
            <p
              className={cn(
                "mt-1 text-4xl font-bold tabular-nums",
                drift.drift_detected
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400",
              )}
            >
              {drift.psi.toFixed(3)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Threshold 0.20 · PSI above this signals distribution shift in
              predicted probabilities.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Last checked {formatDateTime(drift.checked_at)}
          </p>
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          No prediction-drift report yet. PSI is computed once enough recent
          predictions exist.
        </p>
      )}
    </GlassCard>
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
    <div className="space-y-6">
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <DataDriftCard drift={dataDrift} />
            <PredictionDriftCard drift={predictionDrift} />
          </div>

          {/* Monitoring history --------------------------------------------- */}
          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold">Monitoring history</h2>
            </div>
            <DataTable
              columns={historyColumns}
              data={historyItems}
              rowKey={(row) => row.id}
              emptyMessage="No drift checks recorded yet"
              className={cn(drift.isFetching && "opacity-70")}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* External MLOps dashboards ------------------------------------------ */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <RadioTower className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">MLOps dashboards</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-4 py-3 transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <div className="min-w-0">
                <p className="font-medium">{link.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {link.description}
                </p>
              </div>
              <ExternalLink
                className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
