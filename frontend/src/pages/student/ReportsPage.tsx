import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileBarChart,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorState, GlassCard, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { reportApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/utils";

import { useMe } from "@/pages/student/use-student";

const REPORT_CONTENTS: string[] = [
  "Your profile: register number, department, batch and semester",
  "Academic record — CGPA, 10th/12th percentages and attendance",
  "Skill scores — coding, aptitude, communication, technical and leadership",
  "Latest placement probability, risk level and readiness breakdown",
  "Prioritised recommendations to improve your readiness",
];

export default function ReportsPage() {
  const meQuery = useMe();
  const studentId = meQuery.data?.id;

  const downloadMutation = useMutation({
    mutationFn: () => reportApi.downloadStudentReport(studentId as number),
    onSuccess: () => {
      toast.success("Report downloaded.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not generate the report."));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download a shareable PDF summary of your placement readiness."
      />

      {meQuery.isError ? (
        <ErrorState onRetry={() => void meQuery.refetch()} />
      ) : meQuery.isLoading || !studentId ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <GlassCard className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="gradient-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md">
              <FileBarChart className="h-7 w-7" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Student Readiness Report</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  A professionally formatted PDF you can share with mentors or
                  attach to applications. It is generated on demand from your
                  latest profile and prediction data.
                </p>
              </div>

              <div className="rounded-xl border bg-card/50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                  What's inside
                </p>
                <ul className="space-y-1.5">
                  {REPORT_CONTENTS.map((content) => (
                    <li
                      key={content}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                        aria-hidden="true"
                      />
                      <span>{content}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: run a fresh prediction on your dashboard before downloading
                so the report reflects your most recent scores.
              </p>

              <div>
                <Button
                  variant="gradient"
                  onClick={() => downloadMutation.mutate()}
                  disabled={downloadMutation.isPending}
                >
                  {downloadMutation.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Download aria-hidden="true" />
                  )}
                  {downloadMutation.isPending
                    ? "Generating…"
                    : "Download PDF report"}
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
