import { motion } from "framer-motion";
import {
  Award,
  Compass,
  Gauge,
  Lightbulb,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { FeatureImportanceChart } from "@/components/charts";
import { RiskBadge, ScoreRing } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatPercent, formatScore } from "@/lib/utils";
import type { ExplanationFactor, Prediction, Priority } from "@/types";

const PRIORITY_VARIANT: Record<Priority, "danger" | "warning" | "secondary"> = {
  high: "danger",
  medium: "warning",
  low: "secondary",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
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

/** Small eyebrow + title header with a tinted icon chip, matching the app pattern. */
function SectionHead({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: typeof Target;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="text-lg font-semibold leading-tight tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

/** One signed SHAP contribution row inside the positive/negative columns. */
function ContributionRow({
  factor,
  positive,
}: {
  factor: ExplanationFactor;
  positive: boolean;
}) {
  const impact = Math.abs(factor.impact ?? 0);
  return (
    <motion.li
      variants={listItemVariants}
      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-2"
    >
      <span className="min-w-0 truncate text-sm">{factor.label}</span>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          positive ? "text-success" : "text-destructive"
        }`}
      >
        {positive ? "+" : "−"}
        {impact.toFixed(2)}
      </span>
    </motion.li>
  );
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

  const positiveFactors = prediction.explanation.top_positive
    .slice()
    .sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0));
  const negativeFactors = prediction.explanation.top_negative
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
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero — signature placement-probability gauge on the premium AI surface */}
      <motion.section variants={itemVariants} className="gradient-border overflow-hidden">
        <div className="hero-sheen relative rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
              <ScoreRing
                value={prediction.placement_probability * 100}
                label="Placement probability"
                size={168}
              />
              <div className="min-w-0 text-center sm:text-left">
                <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:justify-start">
                  <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  AI Placement Prediction
                </p>
                <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                  <span className="gradient-text">
                    {formatPercent(prediction.placement_probability, 1)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  estimated probability of placement
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <RiskBadge level={prediction.risk_level} />
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    <Gauge className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Readiness {formatScore(prediction.readiness.overall)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-muted-foreground sm:text-right">
              <p>
                Model{" "}
                <span className="font-medium text-foreground">
                  {prediction.model_version}
                </span>
              </p>
              <p className="mt-0.5">{formatDateTime(prediction.created_at)}</p>
            </div>
          </div>

          {prediction.risk_reasons.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border/50 pt-5">
              {prediction.risk_reasons.map((reason) => (
                <Badge key={reason} variant="outline">
                  {reason}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* Readiness rings */}
      <motion.section variants={itemVariants} className="surface-card p-6">
        <SectionHead
          eyebrow="Diagnostics"
          title="Readiness Breakdown"
          description="Per-dimension career readiness (0–100)."
          icon={Target}
        />
        <div className="flex flex-wrap items-start justify-center gap-6 sm:justify-between">
          {readinessRings.map((ring) => (
            <ScoreRing
              key={ring.label}
              value={ring.value}
              label={ring.label}
              size={96}
            />
          ))}
        </div>
      </motion.section>

      {/* SHAP explanation — premium AI card */}
      <motion.section variants={itemVariants} className="gradient-border p-6">
        <SectionHead
          eyebrow="Explainability"
          title="What Drives This Prediction"
          description="Signed SHAP impact — teal factors lift the probability, rose factors pull it down."
          icon={Award}
        />
        {signedFactors.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <FeatureImportanceChart data={signedFactors} signed />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-success">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Lifting the score
                </p>
                {positiveFactors.length > 0 ? (
                  <motion.ul
                    className="space-y-2"
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {positiveFactors.map((factor) => (
                      <ContributionRow
                        key={factor.feature}
                        factor={factor}
                        positive
                      />
                    ))}
                  </motion.ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No positive drivers surfaced.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-destructive">
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Holding it back
                </p>
                {negativeFactors.length > 0 ? (
                  <motion.ul
                    className="space-y-2"
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {negativeFactors.map((factor) => (
                      <ContributionRow
                        key={factor.feature}
                        factor={factor}
                        positive={false}
                      />
                    ))}
                  </motion.ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No factors are dragging the score down.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No explanation factors available for this prediction.
          </p>
        )}
      </motion.section>

      {/* Skill gaps + recommendations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section variants={itemVariants} className="surface-card p-6">
          <SectionHead
            eyebrow="Focus areas"
            title="Skill Gaps"
            description="Distance from the target for each tracked skill."
            icon={Target}
          />
          {prediction.skill_gaps.length > 0 ? (
            <motion.ul
              className="space-y-4"
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
                    className="space-y-1.5"
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
                        className="gradient-primary h-full rounded-full"
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
              No significant skill gaps detected — nice work.
            </p>
          )}
        </motion.section>

        <motion.section variants={itemVariants} className="surface-card p-6">
          <SectionHead
            eyebrow="Action plan"
            title="Recommendations"
            description="Prioritised next steps to raise readiness."
            icon={Lightbulb}
          />
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
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/50 p-3.5"
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
        </motion.section>
      </div>

      {/* Career matches */}
      <motion.section variants={itemVariants} className="surface-card p-6">
        <SectionHead
          eyebrow="Direction"
          title="Career Matches"
          description="Roles best aligned with this profile."
          icon={Compass}
        />
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
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-border/60 bg-card/50 p-4 transition-shadow hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">{career.role}</p>
                  <span className="gradient-text shrink-0 text-lg font-bold tabular-nums">
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
      </motion.section>
    </motion.div>
  );
}
