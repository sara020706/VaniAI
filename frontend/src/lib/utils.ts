import { isAxiosError } from "axios";
import { type ClassValue, clsx } from "clsx";
import { format, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 0–1 probability → "72%" (or fallback when missing). */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

/** 0–100 score → "72.5" (or fallback when missing). */
export function formatScore(
  value: number | null | undefined,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(fractionDigits);
}

/** ISO-8601 timestamp → "12 Mar 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

/** ISO-8601 timestamp → "12 Mar 2026, 14:30". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

/** "Priya Sharma" → "PS" for avatar fallbacks. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extract a human-readable message from an API error (FastAPI envelope
 * `{"detail": "..."}` or its 422 validation shape), for use in toasts.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isAxiosError(error)) {
    const detail: unknown = (error.response?.data as { detail?: unknown } | undefined)
      ?.detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first: unknown = detail[0];
      if (
        typeof first === "object" &&
        first !== null &&
        "msg" in first &&
        typeof (first as { msg: unknown }).msg === "string"
      ) {
        return (first as { msg: string }).msg;
      }
    }
    if (error.code === "ERR_NETWORK") {
      return "Cannot reach the server. Is the backend running?";
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Trigger a browser download for a Blob (CSV exports, PDF reports). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
