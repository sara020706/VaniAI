/**
 * Admin / MLOps console shared query keys and typed TanStack Query hooks.
 *
 * Every admin page consumes these so the query cache is namespaced under a
 * single `["admin", ...]` root and mutations can invalidate precisely.
 * All reads go through F1's `adminApi` module — never raw axios.
 */
import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import { adminApi } from "@/lib/api";
import type {
  Dataset,
  DriftStatus,
  Experiment,
  ModelVersion,
  MonitoringHealth,
  Page,
  PaginationParams,
  User,
  UserListParams,
} from "@/types";

/** Poll interval (ms) used while a training experiment or drift check runs. */
export const POLL_INTERVAL_MS = 5000;

/** Namespaced query keys for the admin feature. */
export const adminKeys = {
  all: ["admin"] as const,
  users: (params: UserListParams) => ["admin", "users", params] as const,
  datasets: (params: PaginationParams) =>
    ["admin", "datasets", params] as const,
  trainingHistory: (params: PaginationParams) =>
    ["admin", "training-history", params] as const,
  models: () => ["admin", "models"] as const,
  health: () => ["admin", "health"] as const,
  drift: () => ["admin", "drift"] as const,
} as const;

/** Paginated, filterable user list. */
export function useUsers(
  params: UserListParams,
): UseQueryResult<Page<User>> {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => adminApi.listUsers(params),
    placeholderData: keepPreviousData,
  });
}

/** Paginated dataset list. */
export function useDatasets(
  params: PaginationParams,
): UseQueryResult<Page<Dataset>> {
  return useQuery({
    queryKey: adminKeys.datasets(params),
    queryFn: () => adminApi.datasets(params),
    placeholderData: keepPreviousData,
  });
}

/** True when any experiment on the page is still running (drives polling). */
export function anyExperimentRunning(experiments: Experiment[]): boolean {
  return experiments.some((experiment) => experiment.status === "running");
}

/**
 * Paginated training history. Polls every {@link POLL_INTERVAL_MS} while any
 * experiment in the current page is `running`.
 */
export function useTrainingHistory(
  params: PaginationParams,
): UseQueryResult<Page<Experiment>> {
  return useQuery({
    queryKey: adminKeys.trainingHistory(params),
    queryFn: () => adminApi.trainingHistory(params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && anyExperimentRunning(data.items)) return POLL_INTERVAL_MS;
      return false;
    },
  });
}

/** Registered model versions (unpaginated per contract). */
export function useModels(): UseQueryResult<ModelVersion[]> {
  return useQuery({
    queryKey: adminKeys.models(),
    queryFn: () => adminApi.models(),
  });
}

/** System health snapshot for the dashboard. */
export function useMonitoringHealth(): UseQueryResult<MonitoringHealth> {
  return useQuery({
    queryKey: adminKeys.health(),
    queryFn: () => adminApi.monitoringHealth(),
  });
}

/** Drift status; `poll` enables 5s refetch while a run is in flight. */
export function useDrift(poll: boolean): UseQueryResult<DriftStatus> {
  return useQuery({
    queryKey: adminKeys.drift(),
    queryFn: () => adminApi.drift(),
    refetchInterval: poll ? POLL_INTERVAL_MS : false,
  });
}
