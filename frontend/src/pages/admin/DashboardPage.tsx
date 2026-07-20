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
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
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

/** Small uppercase section eyebrow that aids scanning. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/** A single system-health tile in the infra status strip. */
function HealthTile({
  label,
  ok,
  value,
  icon: Icon,
  footer,
}: {
  label: string;
  ok: boolean;
  value: React.ReactNode;
  icon: typeof ServerCog;
  footer: React.ReactNode;
}) {
  return (
    <motion.div
      variants={listItem}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="surface-card p-5 transition-shadow hover:shadow-[var(--shadow-lg)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{label}</Eyebrow>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold leading-tight">
            <StatusDot ok={ok} />
            <span className="truncate">{value}</span>
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
            ok
              ? "border-primary/15 bg-primary/10 text-primary"
              : "border-warning/25 bg-warning/10 text-warning",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{footer}</div>
    </motion.div>
  );
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
    <div className="space-y-8">
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
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {health.data?.status === "ok" && (
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success/60" />
            )}
            <StatusDot ok={health.data?.status === "ok"} />
          </span>
          <Eyebrow>System health</Eyebrow>
        </div>

        {health.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-3xl" />
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
              <motion.div
                variants={listItem}
                className="flex items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 px-4 py-3.5 text-warning-foreground"
                role="alert"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
                  <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-foreground">
                    Heuristic fallback active
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    No trained model is deployed — predictions are served by the
                    deterministic heuristic (
                    <code className="rounded bg-warning/15 px-1 py-0.5 font-mono text-xs text-warning">
                      {health.data.model_version}
                    </code>
                    ). Upload a dataset and run training to activate a real model.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="ml-auto shrink-0 border-warning/40 text-warning hover:bg-warning/10"
                >
                  <Link to="/admin/datasets">Go to datasets</Link>
                </Button>
              </motion.div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HealthTile
                label="API Status"
                ok={health.data.status === "ok"}
                value={health.data.status === "ok" ? "Operational" : "Degraded"}
                icon={ServerCog}
                footer={`Uptime ${uptimeLabel(health.data.uptime_seconds)}`}
              />
              <HealthTile
                label="Database"
                ok={health.data.database}
                value={health.data.database ? "Connected" : "Unreachable"}
                icon={Database}
                footer="PostgreSQL connection health"
              />
              <HealthTile
                label="Active Model"
                ok={health.data.model_loaded}
                value={health.data.model_version}
                icon={Cpu}
                footer={
                  health.data.is_fallback ? (
                    <Badge variant="warning">Fallback</Badge>
                  ) : (
                    <Badge variant="success">Trained model</Badge>
                  )
                }
              />
              <HealthTile
                label="MLflow"
                ok={health.data.mlflow_configured}
                value={
                  health.data.mlflow_configured ? "Configured" : "Not configured"
                }
                icon={FlaskConical}
                footer="Experiment tracking backend"
              />
            </div>
          </motion.div>
        ) : null}
      </section>

      {/* Active model metrics -------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          <Eyebrow>Active model metrics</Eyebrow>
        </div>
        {models.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-3xl" />
            ))}
          </div>
        ) : models.isError ? (
          <ErrorState
            title="Could not load models"
            onRetry={() => void models.refetch()}
          />
        ) : activeModel ? (
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-3"
          >
            {HEADLINE_METRICS.map((key) => (
              <motion.div key={key} variants={listItem}>
                <StatCard
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
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="surface-card p-5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-warning/25 bg-warning/10 text-warning">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              No trained model has been registered yet. Metrics will appear once
              training completes.
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent training history --------------------------------------- */}
        <div className="surface-card p-5">
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
            <p className="py-8 text-center text-sm text-muted-foreground">
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
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
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
        </div>

        {/* Drift summary -------------------------------------------------- */}
        <div className="surface-card p-5">
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
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-3">
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

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-3">
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
                    "rounded-2xl border px-3.5 py-2.5 text-xs",
                    dataDrift.data_drift_detected
                      ? "border-warning/30 bg-warning/10 text-warning-foreground"
                      : "border-border/60 bg-muted/30 text-muted-foreground",
                  )}
                >
                  <span className="font-semibold tabular-nums">
                    {(dataDrift.share_drifted * 100).toFixed(1)}%
                  </span>{" "}
                  of features drifted
                  {dataDrift.drifted_features.length > 0 &&
                    ` · ${dataDrift.drifted_features.slice(0, 3).join(", ")}${
                      dataDrift.drifted_features.length > 3 ? "…" : ""
                    }`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
