import { motion } from "framer-motion";
import {
  Award,
  Compass,
  Lightbulb,
  Target,
} from "lucide-react";

import { FeatureImportanceChart } from "@/components/charts";
import { GlassCard, RiskBadge, ScoreRing } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatPercent } from "@/lib/utils";
import type { Prediction, Priority } from "@/types";

const PRIORITY_VARIANT: Record<Priority, "danger" | "warning" | "secondary"> = {
  high: "danger",
  medium: "warning",
  low: "secondary",
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
};

export interface PredictionViewProps {
  prediction: Prediction;
}

/**
 * Full prediction breakdown reused across faculty and (implicitly) student
 * surfaces: headline probability + risk, the five readiness rings, the signed
 * SHAP feature-importance chart, skill gaps, recommendations and career
 * matches. Pure presentation — the caller owns data fetching.
 */
export function PredictionView({ prediction }: PredictionViewProps) {
  const signedFactors = [
    ...prediction.explanation.top_positive,
    ...prediction.explanation.top_negative,
  ]
    .slice()
    .sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0));

  const readinessRings: { label: string; value: number }[] = [
    { label: "Overall", value: prediction.readiness.overall },
    { label: "Academic", value: prediction.readiness.academic },
    { label: "Technical", value: prediction.readiness.technical },
    { label: "Communication", value: prediction.readiness.communication },
    { label: "Industry", value: prediction.readiness.industry },
  ];

  return (
    <div className="space-y-6">
      <GlassCard className="p-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <ScoreRing
              value={prediction.placement_probability * 100}
              label="Placement probability"
              size={120}
            />
            <div>
              <p className="text-sm text-muted-foreground">Placement Probability</p>
              <p className="gradient-text text-3xl font-bold">
                {formatPercent(prediction.placement_probability)}
              </p>
              <div className="mt-2">
                <RiskBadge level={prediction.risk_level} />
              </div>
            </div>
          </div>
          <div className="text-left text-xs text-muted-foreground sm:text-right">
            <p>
              Model{" "}
              <span className="font-medium text-foreground">
                {prediction.model_version}
              </span>
            </p>
            <p>{formatDateTime(prediction.created_at)}</p>
          </div>
        </div>

        {prediction.risk_reasons.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {prediction.risk_reasons.map((reason) => (
              <Badge key={reason} variant="outline">
                {reason}
              </Badge>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          Readiness Breakdown
        </h2>
        <div className="flex flex-wrap items-start justify-center gap-6 sm:justify-between">
          {readinessRings.map((ring) => (
            <ScoreRing
              key={ring.label}
              value={ring.value}
              label={ring.label}
              size={92}
            />
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Award className="h-4 w-4 text-primary" aria-hidden="true" />
            What Drives This Prediction
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Signed SHAP impact — blue lifts the probability, red pulls it down.
          </p>
          {signedFactors.length > 0 ? (
            <FeatureImportanceChart data={signedFactors} signed />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No explanation factors available.
            </p>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
            Skill Gaps
          </h2>
          {prediction.skill_gaps.length > 0 ? (
            <motion.ul
              className="space-y-3"
              variants={listVariants}
              initial="hidden"
              animate="visible"
            >
              {prediction.skill_gaps.map((gap) => {
                const pct =
                  gap.target > 0
                    ? Math.min(100, Math.max(0, (gap.current / gap.target) * 100))
                    : 0;
                return (
                  <motion.li
                    key={gap.skill}
                    variants={listItemVariants}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{gap.skill}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {gap.current.toFixed(0)} / {gap.target.toFixed(0)}
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${gap.skill} progress`}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={PRIORITY_VARIANT[gap.severity]}>
                        {gap.severity} priority
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        gap {gap.gap.toFixed(0)}
                      </span>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No significant skill gaps detected.
            </p>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
          Recommendations
        </h2>
        {prediction.recommendations.length > 0 ? (
          <motion.ul
            className="space-y-3"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {prediction.recommendations.map((rec) => (
              <motion.li
                key={rec.id}
                variants={listItemVariants}
                className="flex items-start gap-3 rounded-xl border bg-card/40 p-3"
              >
                <Badge variant={PRIORITY_VARIANT[rec.priority]} className="mt-0.5">
                  {rec.priority}
                </Badge>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {rec.category}
                  </p>
                  <p className="text-sm">{rec.text}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recommendations at this time.
          </p>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
          Career Matches
        </h2>
        {prediction.career_recommendations.length > 0 ? (
          <motion.div
            className="grid gap-3 sm:grid-cols-2"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {prediction.career_recommendations.map((career) => (
              <motion.div
                key={career.role}
                variants={listItemVariants}
                className="rounded-xl border bg-card/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{career.role}</p>
                  <span className="gradient-text text-lg font-bold tabular-nums">
                    {Math.round(career.match_score)}%
                  </span>
                </div>
                {career.reasons.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {career.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No career matches available yet.
          </p>
        )}
      </GlassCard>
    </div>
  );
}
