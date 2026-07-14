import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Cpu,
  Database,
  FlaskConical,
  Gauge,
  LineChart,
  ServerCog,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
  StatCard,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import type { Experiment } from "@/types";

import {
  ExperimentStatusBadge,
  StatusDot,
  formatMetric,
  metricLabel,
} from "@/pages/admin/status-meta";
import {
  useDrift,
  useModels,
  useMonitoringHealth,
  useTrainingHistory,
} from "@/pages/admin/use-admin";

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
};

/** Metric keys surfaced as headline StatCards for the active model. */
const HEADLINE_METRICS: string[] = ["accuracy", "f1", "roc_auc"];

function uptimeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AdminDashboardPage() {
  const health = useMonitoringHealth();
  const models = useModels();
  const training = useTrainingHistory({ page: 1, page_size: 5 });
  const drift = useDrift(false);

  const activeModel = models.data?.find((model) => model.is_active) ?? null;
  const recentExperiments: Experiment[] = training.data?.items ?? [];

  const dataDrift = drift.data?.data_drift ?? null;
  const predictionDrift = drift.data?.prediction_drift ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="System health, the active placement model, and MLOps activity at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/models">
                <Boxes aria-hidden="true" />
                Models
              </Link>
            </Button>
            <Button variant="gradient" size="sm" asChild>
              <Link to="/admin/monitoring">
                <Gauge aria-hidden="true" />
                Monitoring
              </Link>
            </Button>
          </div>
        }
      />

      {/* System health ---------------------------------------------------- */}
      {health.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : health.isError ? (
        <ErrorState
          title="Could not load system health"
          onRetry={() => void health.refetch()}
        />
      ) : health.data ? (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {health.data.is_fallback && (
            <motion.div variants={listItem}>
              <div
                className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                role="alert"
              >
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <p className="font-semibold">Heuristic fallback active</p>
                  <p className="mt-0.5">
                    No trained model is deployed — predictions are served by the
                    deterministic heuristic (<code>{health.data.model_version}</code>).
                    Upload a dataset and run training to activate a real model.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="ml-auto shrink-0 border-amber-400 dark:border-amber-700"
                >
                  <Link to="/admin/datasets">Go to datasets</Link>
                </Button>
              </div>
            </motion.div>
          )}

          <motion.div
            variants={listItem}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    API Status
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
                    <StatusDot ok={health.data.status === "ok"} />
                    {health.data.status === "ok" ? "Operational" : "Degraded"}
                  </p>
                </div>
                <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md">
                  <ServerCog className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Uptime {uptimeLabel(health.data.uptime_seconds)}
              </p>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Database
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
                    <StatusDot ok={health.data.database} />
                    {health.data.database ? "Connected" : "Unreachable"}
                  </p>
                </div>
                <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md">
                  <Database className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                PostgreSQL connection health
              </p>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Model
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
                    <StatusDot ok={health.data.model_loaded} />
                    <span className="truncate">{health.data.model_version}</span>
                  </p>
                </div>
                <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md">
                  <Cpu className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-3 text-xs">
                {health.data.is_fallback ? (
                  <Badge variant="warning">Fallback</Badge>
                ) : (
                  <Badge variant="success">Trained model</Badge>
                )}
              </p>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    MLflow
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
                    <StatusDot ok={health.data.mlflow_configured} />
                    {health.data.mlflow_configured
                      ? "Configured"
                      : "Not configured"}
                  </p>
                </div>
                <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md">
                  <FlaskConical className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Experiment tracking backend
              </p>
            </GlassCard>
          </motion.div>
        </motion.div>
      ) : null}

      {/* Active model metrics -------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Target className="h-5 w-5 text-primary" aria-hidden="true" />
          Active Model Metrics
        </h2>
        {models.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : models.isError ? (
          <ErrorState
            title="Could not load models"
            onRetry={() => void models.refetch()}
          />
        ) : activeModel ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {HEADLINE_METRICS.map((key) => (
              <StatCard
                key={key}
                title={metricLabel(key)}
                value={formatMetric(activeModel.metrics[key])}
                icon={
                  key === "accuracy"
                    ? Target
                    : key === "f1"
                      ? Activity
                      : LineChart
                }
                description={`${activeModel.version} · ${activeModel.model_type}`}
                gradient
              />
            ))}
          </div>
        ) : (
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ShieldCheck
                className="h-5 w-5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              No trained model has been registered yet. Metrics will appear once
              training completes.
            </div>
          </GlassCard>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent training history --------------------------------------- */}
        <GlassCard className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
              Recent Training
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/models">View all</Link>
            </Button>
          </div>
          {training.isLoading ? (
            <LoadingState label="Loading training history…" />
          ) : training.isError ? (
            <ErrorState onRetry={() => void training.refetch()} />
          ) : recentExperiments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No training runs yet.
            </p>
          ) : (
            <motion.ul
              variants={listContainer}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {recentExperiments.map((experiment) => (
                <motion.li
                  key={experiment.id}
                  variants={listItem}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {experiment.model_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(experiment.started_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {experiment.status === "completed" &&
                      experiment.metrics?.roc_auc !== undefined && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          ROC AUC {formatMetric(experiment.metrics.roc_auc)}
                        </span>
                      )}
                    <ExperimentStatusBadge status={experiment.status} />
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </GlassCard>

        {/* Drift summary -------------------------------------------------- */}
        <GlassCard className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Gauge className="h-5 w-5 text-primary" aria-hidden="true" />
              Drift Status
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/monitoring">Open monitoring</Link>
            </Button>
          </div>
          {drift.isLoading ? (
            <LoadingState label="Loading drift status…" />
          ) : drift.isError ? (
            <ErrorState onRetry={() => void drift.refetch()} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Data drift</p>
                  <p className="text-xs text-muted-foreground">
                    {dataDrift
                      ? `Checked ${formatDateTime(dataDrift.checked_at)}`
                      : "Not checked yet"}
                  </p>
                </div>
                {dataDrift ? (
                  <Badge
                    variant={
                      dataDrift.data_drift_detected ? "danger" : "success"
                    }
                  >
                    {dataDrift.data_drift_detected
                      ? "Drift detected"
                      : "Stable"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">No data</Badge>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Prediction drift</p>
                  <p className="text-xs text-muted-foreground">
                    {predictionDrift
                      ? `PSI ${predictionDrift.psi.toFixed(3)} · ${formatDateTime(
                          predictionDrift.checked_at,
                        )}`
                      : "Not checked yet"}
                  </p>
                </div>
                {predictionDrift ? (
                  <Badge
                    variant={
                      predictionDrift.drift_detected ? "danger" : "success"
                    }
                  >
                    {predictionDrift.drift_detected ? "Drift detected" : "Stable"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">No data</Badge>
                )}
              </div>

              {dataDrift && (
                <div
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs",
                    dataDrift.data_drift_detected
                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                      : "border-border bg-card/40 text-muted-foreground",
                  )}
                >
                  {(dataDrift.share_drifted * 100).toFixed(1)}% of features
                  drifted
                  {dataDrift.drifted_features.length > 0 &&
                    ` · ${dataDrift.drifted_features.slice(0, 3).join(", ")}${
                      dataDrift.drifted_features.length > 3 ? "…" : ""
                    }`}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
