import { LineChart, Radar, TrendingUp, type LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  ProgressAreaChart,
  TrendLineChart,
  type ChartDatum,
} from "@/components/charts";
import { EmptyState, ErrorState, GlassCard, PageHeader } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

import {
  usePredictionHistory,
  useMe,
  useStudentProgress,
} from "@/pages/student/use-student";

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="gradient-primary flex h-8 w-8 items-center justify-center rounded-lg text-white shadow">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-semibold leading-tight">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Not enough data yet"
      description={label}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const meQuery = useMe();
  const studentId = meQuery.data?.id;

  const progressQuery = useStudentProgress(studentId);
  const historyQuery = usePredictionHistory(studentId);

  const academicData: ChartDatum[] = useMemo(
    () =>
      (progressQuery.data?.academic_history ?? [])
        .map((point) => ({
          date: formatDate(point.recorded_at),
          cgpa: Number((point.cgpa * 10).toFixed(1)),
          attendance: Number(point.attendance_percentage.toFixed(1)),
        })),
    [progressQuery.data],
  );

  const skillData: ChartDatum[] = useMemo(
    () =>
      (progressQuery.data?.skill_history ?? []).map((point) => ({
        date: formatDate(point.recorded_at),
        coding_score: Number(point.coding_score.toFixed(1)),
        aptitude_score: Number(point.aptitude_score.toFixed(1)),
        communication_score: Number(point.communication_score.toFixed(1)),
        technical_skill_score: Number(point.technical_skill_score.toFixed(1)),
        leadership_score: Number(point.leadership_score.toFixed(1)),
      })),
    [progressQuery.data],
  );

  const predictionData: ChartDatum[] = useMemo(
    () =>
      [...(historyQuery.data ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((item) => ({
          date: formatDate(item.created_at),
          probability: Math.round(item.placement_probability * 100),
          readiness: Math.round(item.readiness_overall),
        })),
    [historyQuery.data],
  );

  const isError = meQuery.isError || progressQuery.isError || historyQuery.isError;
  const isLoading =
    meQuery.isLoading ||
    !studentId ||
    progressQuery.isLoading ||
    historyQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Progress"
        description="Track how your academics, skills and placement readiness have evolved over time."
      />

      {isError ? (
        <ErrorState
          onRetry={() => {
            void meQuery.refetch();
            void progressQuery.refetch();
            void historyQuery.refetch();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <>
          <Section
            title="Academic History"
            description="CGPA (scaled to 100) and attendance across recorded snapshots"
            icon={TrendingUp}
          >
            {academicData.length >= 2 ? (
              <ProgressAreaChart
                data={academicData}
                xKey="date"
                series={[
                  { key: "cgpa", name: "CGPA ×10" },
                  { key: "attendance", name: "Attendance %" },
                ]}
              />
            ) : (
              <ChartEmpty label="Academic snapshots will appear here as your records are updated over time." />
            )}
          </Section>

          <Section
            title="Skill History"
            description="Your skill scores across recorded snapshots"
            icon={Radar}
          >
            {skillData.length >= 2 ? (
              <TrendLineChart
                data={skillData}
                xKey="date"
                series={[
                  { key: "coding_score", name: "Coding" },
                  { key: "aptitude_score", name: "Aptitude" },
                  { key: "communication_score", name: "Communication" },
                  { key: "technical_skill_score", name: "Technical" },
                  { key: "leadership_score", name: "Leadership" },
                ]}
                height={320}
              />
            ) : (
              <ChartEmpty label="Skill snapshots will appear here as your records are updated over time." />
            )}
          </Section>

          <Section
            title="Prediction History"
            description="Placement probability and overall readiness across predictions"
            icon={LineChart}
          >
            {predictionData.length >= 2 ? (
              <TrendLineChart
                data={predictionData}
                xKey="date"
                series={[
                  { key: "probability", name: "Probability (%)" },
                  { key: "readiness", name: "Readiness" },
                ]}
              />
            ) : (
              <ChartEmpty label="Run predictions over time from your dashboard to build this trend." />
            )}
          </Section>
        </>
      )}
    </div>
  );
}
