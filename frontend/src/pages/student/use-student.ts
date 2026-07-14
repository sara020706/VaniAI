/**
 * Shared TanStack Query hooks for the student experience (F2).
 *
 * Every student page needs the signed-in student's own profile — the
 * backend derives it from the JWT via `/students/me`, and its `id` is the
 * `student_id` that prediction / resume / progress endpoints key off. These
 * hooks centralise the query keys so mutations across the student pages
 * invalidate consistently.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { predictionApi, resumeApi, studentApi } from "@/lib/api";
import type {
  Prediction,
  PredictionHistoryItem,
  ResumeAnalysis,
  Student,
  StudentProgress,
} from "@/types";

/** Namespaced query keys for the student feature. */
export const studentKeys = {
  me: ["student", "me"] as const,
  progress: (studentId: number) =>
    ["student", "progress", studentId] as const,
  latestPrediction: (studentId: number) =>
    ["student", "prediction", "latest", studentId] as const,
  predictionHistory: (studentId: number) =>
    ["student", "prediction", "history", studentId] as const,
  latestResume: (studentId: number) =>
    ["student", "resume", "latest", studentId] as const,
};

/** The signed-in student's own profile. */
export function useMe(): UseQueryResult<Student> {
  return useQuery({
    queryKey: studentKeys.me,
    queryFn: () => studentApi.getMe(),
  });
}

/** Historical academic / skill / prediction series for progress charts. */
export function useStudentProgress(
  studentId: number | undefined,
): UseQueryResult<StudentProgress> {
  return useQuery({
    queryKey: studentKeys.progress(studentId ?? 0),
    queryFn: () => studentApi.progress(studentId as number),
    enabled: studentId !== undefined,
  });
}

/**
 * The latest prediction for a student. The backend returns 404 when none
 * has been run yet — that is a legitimate "no prediction" state, not an
 * error, so callers should treat `data === undefined` after a settled query
 * as "nothing to show yet". Retries are disabled so a 404 resolves fast.
 */
export function useLatestPrediction(
  studentId: number | undefined,
): UseQueryResult<Prediction> {
  return useQuery({
    queryKey: studentKeys.latestPrediction(studentId ?? 0),
    queryFn: () => predictionApi.latest(studentId as number),
    enabled: studentId !== undefined,
    retry: false,
  });
}

/** Prediction history (probability + readiness over time). */
export function usePredictionHistory(
  studentId: number | undefined,
): UseQueryResult<PredictionHistoryItem[]> {
  return useQuery({
    queryKey: studentKeys.predictionHistory(studentId ?? 0),
    queryFn: () => predictionApi.history(studentId as number),
    enabled: studentId !== undefined,
  });
}

/** The latest resume analysis; 404 ⇒ nothing uploaded yet. */
export function useLatestResume(
  studentId: number | undefined,
): UseQueryResult<ResumeAnalysis> {
  return useQuery({
    queryKey: studentKeys.latestResume(studentId ?? 0),
    queryFn: () => resumeApi.latest(studentId as number),
    enabled: studentId !== undefined,
    retry: false,
  });
}
