import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Loader2,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "@/lib/api";
import { cn, formatDateTime, getApiErrorMessage } from "@/lib/utils";
import type { Experiment, ModelVersion } from "@/types";

import {
  ExperimentStatusBadge,
  formatMetric,
} from "@/pages/admin/status-meta";
import {
  adminKeys,
  anyExperimentRunning,
  useModels,
  useTrainingHistory,
} from "@/pages/admin/use-admin";

const PAGE_SIZE = 10;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ---------------------------------------------------------------------------
// Deploy confirm dialog
// ---------------------------------------------------------------------------

function DeployDialog({
  model,
  onClose,
}: {
  model: ModelVersion | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (version: string) => adminApi.deployModel(version),
    onSuccess: (deployed) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success(`Deployed ${deployed.version}. It is now the active model.`);
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not deploy this version."));
    },
  });

  return (
    <Dialog open={Boolean(model)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Rocket className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Deploy {model?.version}?</DialogTitle>
          <DialogDescription>
            This activates{" "}
            <span className="font-medium text-foreground">{model?.version}</span>{" "}
            ({model?.model_type}) and reloads the predictor. All new predictions
            will use this model until another version is deployed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="gradient"
            disabled={mutation.isPending}
            onClick={() => model && mutation.mutate(model.version)}
          >
            {mutation.isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            Deploy version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminModelsPage() {
  const [historyPage, setHistoryPage] = useState(1);
  const [deployModel, setDeployModel] = useState<ModelVersion | null>(null);

  const queryClient = useQueryClient();

  const historyParams = useMemo(
    () => ({ page: historyPage, page_size: PAGE_SIZE }),
    [historyPage],
  );
  const history = useTrainingHistory(historyParams);
  const models = useModels();

  const experiments: Experiment[] = history.data?.items ?? [];
  const isTrainingRunning = anyExperimentRunning(experiments);

  const total = history.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const retrainMutation = useMutation({
    mutationFn: () => adminApi.triggerRetraining(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success("Retraining started on the latest used dataset.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not trigger retraining."));
    },
  });

  const experimentColumns: DataTableColumn<Experiment>[] = [
    {
      key: "model_type",
      header: "Model",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.model_type}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatDateTime(row.started_at)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <ExperimentStatusBadge status={row.status} />,
    },
    {
      key: "roc_auc",
      header: "ROC AUC",
      className: "tabular-nums",
      render: (row) =>
        row.status === "completed" && row.metrics
          ? formatMetric(row.metrics.roc_auc)
          : "—",
    },
    {
      key: "f1",
      header: "F1",
      className: "tabular-nums",
      render: (row) =>
        row.status === "completed" && row.metrics
          ? formatMetric(row.metrics.f1)
          : "—",
    },
    {
      key: "finished_at",
      header: "Finished",
      className: "tabular-nums",
      render: (row) =>
        row.finished_at ? formatDateTime(row.finished_at) : "—",
    },
  ];

  const modelColumns: DataTableColumn<ModelVersion>[] = [
    {
      key: "version",
      header: "Version",
      render: (row) => (
        <span className="flex items-center gap-2 font-medium">
          {row.version}
          {row.is_active && (
            <Badge variant="success">
              <CheckCircle2 aria-hidden="true" />
              Active
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "model_type",
      header: "Type",
    },
    {
      key: "roc_auc",
      header: "ROC AUC",
      className: "tabular-nums",
      render: (row) => formatMetric(row.metrics.roc_auc),
    },
    {
      key: "f1",
      header: "F1",
      className: "tabular-nums",
      render: (row) => formatMetric(row.metrics.f1),
    },
    {
      key: "created_at",
      header: "Created",
      className: "tabular-nums",
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) =>
        row.is_active ? (
          <span className="text-xs text-muted-foreground">Deployed</span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeployModel(row)}
          >
            <Rocket aria-hidden="true" />
            Deploy
          </Button>
        ),
    },
  ];

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <PageHeader
        title="Models"
        description="Training runs, registered model versions, and deployment controls."
        actions={
          <Button
            variant="gradient"
            onClick={() => retrainMutation.mutate()}
            disabled={retrainMutation.isPending || isTrainingRunning}
          >
            {retrainMutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Trigger retraining
          </Button>
        }
      />

      {isTrainingRunning && (
        <motion.div
          variants={itemVariants}
          className="glass-card flex items-center gap-3 rounded-2xl border-warning/30 px-4 py-3 text-sm shadow-md"
          role="status"
        >
          <span
            className="relative flex h-2.5 w-2.5 shrink-0"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
          </span>
          <span className="font-medium text-warning">Training in progress</span>
          <span className="text-muted-foreground">
            — this page refreshes automatically every few seconds.
          </span>
        </motion.div>
      )}

      {/* Training history --------------------------------------------------- */}
      <motion.div variants={itemVariants}>
        <GlassCard className="p-6">
          <div className="mb-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Experiments
            </p>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold tracking-tight">
              Training history
            </h2>
          </div>
        {history.isLoading ? (
          <LoadingState label="Loading training history…" />
        ) : history.isError ? (
          <ErrorState onRetry={() => void history.refetch()} />
        ) : history.data ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <DataTable
              columns={experimentColumns}
              data={experiments}
              rowKey={(row) => row.id}
              emptyMessage="No training runs yet"
            />
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                {total === 0 ? "No results" : `${total} run(s)`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHistoryPage((current) => Math.max(1, current - 1))
                  }
                  disabled={historyPage <= 1 || history.isFetching}
                >
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  Page {historyPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHistoryPage((current) =>
                      Math.min(totalPages, current + 1),
                    )
                  }
                  disabled={historyPage >= totalPages || history.isFetching}
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
        </GlassCard>
      </motion.div>

      {/* Model versions ---------------------------------------------------- */}
      <motion.div variants={itemVariants}>
        <GlassCard className="p-6">
          <div className="mb-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Registry
            </p>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold tracking-tight">Model versions</h2>
          </div>
          {models.isLoading ? (
          <LoadingState label="Loading model versions…" />
        ) : models.isError ? (
          <ErrorState onRetry={() => void models.refetch()} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <DataTable
              columns={modelColumns}
              data={models.data ?? []}
              rowKey={(row) => row.id}
              emptyMessage="No models registered yet"
              className={cn(models.isFetching && "opacity-70")}
            />
          </motion.div>
          )}
        </GlassCard>
      </motion.div>

      <DeployDialog
        model={deployModel}
        onClose={() => setDeployModel(null)}
      />
    </motion.div>
  );
}
