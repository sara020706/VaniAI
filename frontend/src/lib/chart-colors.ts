/**
 * Theme-aware, CVD-validated chart palette (CONTRACTS.md §8.6).
 *
 * `useChartColors()` reads the live theme from `use-theme`, so any chart that
 * consumes it restyles instantly when the user toggles light/dark mode.
 */
import { useMemo } from "react";

import { useTheme, type ResolvedTheme } from "@/hooks/use-theme";
import type { RiskLevel } from "@/types";

/** Categorical series colors — fixed order, never cycled; fold >8 into "Other". */
const CATEGORICAL_LIGHT: readonly string[] = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
  "#eb6834",
];

const CATEGORICAL_DARK: readonly string[] = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
  "#d95926",
];

/** Sequential blue ramp (light → dark) for heatmaps / magnitude encoding. */
const SEQUENTIAL: readonly string[] = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#256abf",
  "#184f95",
  "#0d366b",
];

export interface StatusColors {
  good: string;
  warning: string;
  serious: string;
  critical: string;
}

/** Status colors — reserved for state, never reused as "series 4". */
const STATUS: StatusColors = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

const GRID_LIGHT = "#e1e0d9";
const GRID_DARK = "#2c2c2a";
const AXIS_TEXT = "#898781";
const SURFACE_LIGHT = "#fcfcfb";
const SURFACE_DARK = "#1a1a19";

export interface ChartColors {
  /** Which theme these colors were resolved for. */
  mode: ResolvedTheme;
  /** Categorical series colors, fixed assignment order. */
  categorical: readonly string[];
  /** Sequential ramp, light → dark. */
  sequential: readonly string[];
  /** Status colors (good/warning/serious/critical). */
  status: StatusColors;
  /** Hairline grid color. */
  grid: string;
  /** Muted axis/tick text color. */
  axisText: string;
  /** Chart surface color (used for mark rings / stack gaps). */
  surface: string;
  /** Signed-bar positive (blue). */
  positive: string;
  /** Signed-bar negative (red). */
  negative: string;
  /** Risk level → status color (low→good, medium→warning, high→critical). */
  risk: (level: RiskLevel) => string;
  /** Map a 0–1 share onto the sequential ramp. */
  sequentialAt: (share: number) => string;
}

export function getChartColors(mode: ResolvedTheme): ChartColors {
  const categorical = mode === "dark" ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  return {
    mode,
    categorical,
    sequential: SEQUENTIAL,
    status: STATUS,
    grid: mode === "dark" ? GRID_DARK : GRID_LIGHT,
    axisText: AXIS_TEXT,
    surface: mode === "dark" ? SURFACE_DARK : SURFACE_LIGHT,
    positive: categorical[0],
    negative: categorical[5],
    risk: (level: RiskLevel) =>
      level === "low"
        ? STATUS.good
        : level === "medium"
          ? STATUS.warning
          : STATUS.critical,
    sequentialAt: (share: number) => {
      const clamped = Math.min(1, Math.max(0, share));
      const index = Math.min(
        SEQUENTIAL.length - 1,
        Math.floor(clamped * SEQUENTIAL.length),
      );
      return SEQUENTIAL[index];
    },
  };
}

/** Hook version — re-resolves when the theme toggles, restyling charts live. */
export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  return useMemo(() => getChartColors(resolvedTheme), [resolvedTheme]);
}

/** Relative luminance of a hex color (0 black → 1 white). */
export function hexLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const linear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Pick white or near-black ink for text drawn on `background`. */
export function readableTextColor(background: string): string {
  return hexLuminance(background) > 0.45 ? "#1a1a19" : "#ffffff";
}
