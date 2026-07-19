import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Play,
  UploadCloud,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api";
import { cn, formatDateTime, getApiErrorMessage } from "@/lib/utils";
import type { Dataset } from "@/types";

import { DatasetStatusBadge } from "@/pages/admin/status-meta";
import { adminKeys, useDatasets } from "@/pages/admin/use-admin";

const PAGE_SIZE = 20;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

const uploadSchema = z.object({
  name: z.string().trim().max(120, "Name is too long").optional(),
});
type UploadForm = z.infer<typeof uploadSchema>;

function isCsvFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  );
}

function UploadCard() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { name: "" },
  });

  const mutation = useMutation({
    mutationFn: (payload: { file: File; name?: string }) =>
      adminApi.uploadDataset(payload.file, payload.name),
    onSuccess: (dataset) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      if (dataset.status === "invalid") {
        toast.warning(
          `"${dataset.name}" uploaded but failed validation. Review the errors below.`,
        );
      } else {
        toast.success(
          `"${dataset.name}" uploaded — ${dataset.row_count.toLocaleString()} rows validated.`,
        );
      }
      reset();
      setFile(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not upload the dataset."));
    },
  });

  const acceptFile = useCallback((next: File) => {
    if (!isCsvFile(next)) {
      toast.error("Please choose a .csv file.");
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      toast.error("File exceeds the 20 MB limit.");
      return;
    }
    setFile(next);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) acceptFile(dropped);
    },
    [acceptFile],
  );

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <FileUp className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-base font-semibold">Upload training dataset</h2>
      </div>
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          if (!file) {
            toast.error("Choose a CSV file to upload first.");
            return;
          }
          mutation.mutate({
            file,
            name: values.name?.trim() ? values.name.trim() : undefined,
          });
        })}
        noValidate
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose or drop a CSV file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card/40 hover:border-primary/60",
          )}
        >
          <div className="gradient-primary flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md">
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          </div>
          {file ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · click to replace
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">
                Drag &amp; drop a CSV, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Columns must match the training schema · up to 20 MB
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) acceptFile(chosen);
              event.target.value = "";
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dataset-name">
            Dataset name{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="dataset-name"
            placeholder="Defaults to the file name"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="gradient"
            disabled={mutation.isPending || !file}
          >
            {mutation.isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            Upload &amp; validate
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Validation errors dialog
// ---------------------------------------------------------------------------

function ValidationErrorsDialog({
  dataset,
  onClose,
}: {
  dataset: Dataset | null;
  onClose: () => void;
}) {
  const errors = dataset?.validation_errors ?? [];
  return (
    <Dialog open={Boolean(dataset)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle
              className="h-5 w-5 text-destructive"
              aria-hidden="true"
            />
            Validation errors
          </DialogTitle>
          <DialogDescription>
            {dataset?.name} failed schema validation and cannot be used for
            training until the issues below are resolved.
          </DialogDescription>
        </DialogHeader>
        {errors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No specific errors were recorded.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {errors.map((message, index) => (
              <li
                key={index}
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="break-words">{message}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDatasetsPage() {
  const [page, setPage] = useState(1);
  const [errorsDataset, setErrorsDataset] = useState<Dataset | null>(null);

  const queryClient = useQueryClient();
  const params = useMemo(() => ({ page, page_size: PAGE_SIZE }), [page]);
  const query = useDatasets(params);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const trainMutation = useMutation({
    mutationFn: (datasetId: number) => adminApi.startTraining(datasetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success("Training started. Track progress on the Models page.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not start training."));
    },
  });

  const columns: DataTableColumn<Dataset>[] = [
    {
      key: "name",
      header: "Dataset",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.filename}
          </p>
        </div>
      ),
    },
    {
      key: "row_count",
      header: "Rows",
      className: "tabular-nums",
      render: (row) => row.row_count.toLocaleString(),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <DatasetStatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      header: "Uploaded",
      className: "tabular-nums",
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        if (row.status === "invalid") {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setErrorsDataset(row)}
            >
              <AlertCircle aria-hidden="true" />
              View errors
            </Button>
          );
        }
        if (row.status === "validated" || row.status === "used") {
          const isTraining =
            trainMutation.isPending && trainMutation.variables === row.id;
          return (
            <Button
              variant="gradient"
              size="sm"
              disabled={trainMutation.isPending}
              onClick={() => trainMutation.mutate(row.id)}
            >
              {isTraining ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              Start training
            </Button>
          );
        }
        return (
          <Badge variant="secondary" className="capitalize">
            Awaiting validation
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datasets"
        description="Upload training data, review validation results, and launch model training."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <UploadCard />

        <div className="space-y-4">
          {query.isLoading ? (
            <LoadingState label="Loading datasets…" />
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : query.data ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <DataTable
                columns={columns}
                data={query.data.items}
                rowKey={(row) => row.id}
                emptyMessage="No datasets uploaded yet"
              />

              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  {total === 0
                    ? "No results"
                    : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page <= 1 || query.isFetching}
                  >
                    <ChevronLeft aria-hidden="true" />
                    Previous
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={page >= totalPages || query.isFetching}
                  >
                    Next
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <ValidationErrorsDialog
        dataset={errorsDataset}
        onClose={() => setErrorsDataset(null)}
      />
    </div>
  );
}
