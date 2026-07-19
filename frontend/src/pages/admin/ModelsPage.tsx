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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deploy {model?.version}?</DialogTitle>
          <DialogDescription>
            This activates {model?.version} ({model?.model_type}) and reloads
            the predictor. All new predictions will use this model until another
            version is deployed.
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
    <div className="space-y-6">
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
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
          role="status"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>
            A training run is in progress — this page refreshes automatically
            every few seconds.
          </span>
        </motion.div>
      )}

      {/* Training history --------------------------------------------------- */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Training history</h2>
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

      {/* Model versions ---------------------------------------------------- */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Model versions</h2>
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

      <DeployDialog
        model={deployModel}
        onClose={() => setDeployModel(null)}
      />
    </div>
  );
}
