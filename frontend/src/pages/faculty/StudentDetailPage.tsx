import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  FileText,
  Mail,
  Play,
  Sparkles,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ProgressAreaChart, TrendLineChart } from "@/components/charts";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { predictionApi, studentApi } from "@/lib/api";
import { formatDate, formatScore, getApiErrorMessage } from "@/lib/utils";
import type { Student } from "@/types";

import { PredictionView } from "./PredictionView";

function parseStudentId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface ProfileFactProps {
  label: string;
  value: string;
}

function ProfileFact({ label, value }: ProfileFactProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Detailed single-student view for faculty: profile summary, the latest
 * prediction breakdown, progress-over-time charts, and a "Run Prediction"
 * action that regenerates the pipeline and refreshes every dependent query.
 */
export default function FacultyStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const studentId = parseStudentId(params.id);

  const studentQuery = useQuery({
    queryKey: ["faculty", "student", studentId],
    queryFn: () => studentApi.get(studentId as number),
    enabled: studentId !== null,
  });

  const progressQuery = useQuery({
    queryKey: ["faculty", "student", studentId, "progress"],
    queryFn: () => studentApi.progress(studentId as number),
    enabled: studentId !== null,
  });

  const runPrediction = useMutation({
    mutationFn: () => predictionApi.predict(studentId as number),
    onSuccess: async () => {
      toast.success("Prediction generated");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["faculty", "student", studentId],
        }),
        queryClient.invalidateQueries({ queryKey: ["faculty", "analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["faculty", "students"] }),
      ]);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not run the prediction."));
    },
  });

  if (studentId === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student" />
        <ErrorState
          title="Invalid student"
          description="That student id is not valid."
          onRetry={() => navigate("/faculty/students")}
        />
      </div>
    );
  }

  const student: Student | undefined = studentQuery.data;

  const academicHistory = progressQuery.data?.academic_history ?? [];
  const skillHistory = progressQuery.data?.skill_history ?? [];
  const predictionHistory = progressQuery.data?.prediction_history ?? [];

  const academicChartData = academicHistory.map((point) => ({
    date: formatDate(point.recorded_at),
    cgpa: point.cgpa,
    attendance: point.attendance_percentage,
  }));

  const skillChartData = skillHistory.map((point) => ({
    date: formatDate(point.recorded_at),
    coding: point.coding_score,
    aptitude: point.aptitude_score,
    communication: point.communication_score,
    technical: point.technical_skill_score,
    leadership: point.leadership_score,
  }));

  const probabilityChartData = predictionHistory.map((point) => ({
    date: formatDate(point.created_at),
    probability: Number((point.placement_probability * 100).toFixed(1)),
    readiness: point.readiness_overall,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={student?.full_name ?? "Student"}
        description={
          student
            ? `${student.register_number} · ${student.department} · Batch ${student.batch}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/faculty/students")}>
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <Button
              variant="gradient"
              onClick={() => runPrediction.mutate()}
              disabled={runPrediction.isPending || !student}
            >
              <Play aria-hidden="true" />
              {runPrediction.isPending ? "Running…" : "Run Prediction"}
            </Button>
          </div>
        }
      />

      {studentQuery.isLoading ? (
        <LoadingState label="Loading student…" />
      ) : studentQuery.isError || !student ? (
        <ErrorState onRetry={() => void studentQuery.refetch()} />
      ) : (
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <GlassCard className="p-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {student.email}
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Semester {student.semester}
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                {student.experience.internship_count} internships ·{" "}
                {student.experience.project_count} projects
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <ProfileFact
                label="CGPA"
                value={formatScore(student.academic.cgpa, 2)}
              />
              <ProfileFact
                label="Attendance"
                value={formatScore(student.academic.attendance_percentage, 1)}
              />
              <ProfileFact
                label="Coding"
                value={formatScore(student.skills.coding_score, 1)}
              />
              <ProfileFact
                label="Aptitude"
                value={formatScore(student.skills.aptitude_score, 1)}
              />
              <ProfileFact
                label="Communication"
                value={formatScore(student.skills.communication_score, 1)}
              />
              <ProfileFact
                label="Resume"
                value={formatScore(student.professional.resume_score, 1)}
              />
            </div>
          </GlassCard>

          {student.latest_prediction ? (
            <PredictionView prediction={student.latest_prediction} />
          ) : (
            <GlassCard className="p-5">
              <EmptyState
                icon={Sparkles}
                title="No prediction yet"
                description="Run a prediction to generate readiness scores, explanations and recommendations for this student."
                action={
                  <Button
                    variant="gradient"
                    onClick={() => runPrediction.mutate()}
                    disabled={runPrediction.isPending}
                  >
                    <Play aria-hidden="true" />
                    {runPrediction.isPending ? "Running…" : "Run Prediction"}
                  </Button>
                }
              />
            </GlassCard>
          )}

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              Progress Over Time
            </h2>
            {progressQuery.isLoading ? (
              <LoadingState label="Loading progress…" />
            ) : progressQuery.isError ? (
              <ErrorState onRetry={() => void progressQuery.refetch()} />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <GlassCard className="p-5">
                  <h3 className="mb-2 text-sm font-semibold">Academic</h3>
                  {academicChartData.length > 0 ? (
                    <ProgressAreaChart
                      data={academicChartData}
                      xKey="date"
                      series={[
                        { key: "cgpa", name: "CGPA" },
                        { key: "attendance", name: "Attendance %" },
                      ]}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No academic history recorded yet.
                    </p>
                  )}
                </GlassCard>
                <GlassCard className="p-5">
                  <h3 className="mb-2 text-sm font-semibold">Skills</h3>
                  {skillChartData.length > 0 ? (
                    <TrendLineChart
                      data={skillChartData}
                      xKey="date"
                      series={[
                        { key: "coding", name: "Coding" },
                        { key: "aptitude", name: "Aptitude" },
                        { key: "communication", name: "Communication" },
                        { key: "technical", name: "Technical" },
                        { key: "leadership", name: "Leadership" },
                      ]}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No skill history recorded yet.
                    </p>
                  )}
                </GlassCard>
                <GlassCard className="p-5 lg:col-span-2">
                  <h3 className="mb-2 text-sm font-semibold">
                    Placement Probability &amp; Readiness
                  </h3>
                  {probabilityChartData.length > 0 ? (
                    <TrendLineChart
                      data={probabilityChartData}
                      xKey="date"
                      series={[
                        { key: "probability", name: "Probability %" },
                        { key: "readiness", name: "Readiness" },
                      ]}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No prediction history yet — run a prediction to start
                      tracking.
                    </p>
                  )}
                </GlassCard>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
