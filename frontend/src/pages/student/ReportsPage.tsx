import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Download,
  FileBarChart,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorState, PageHeader } from "@/components/shared";
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

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
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Download a shareable PDF summary of your placement readiness."
      />

      {meQuery.isError ? (
        <ErrorState onRetry={() => void meQuery.refetch()} />
      ) : meQuery.isLoading || !studentId ? (
        <Skeleton className="h-72 rounded-3xl" />
      ) : (
        <motion.div
          className="grid gap-6 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Primary report — the premium AI/prediction-derived card */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2 }}
            className="lg:col-span-2"
          >
            <div className="gradient-border h-full transition-shadow hover:shadow-[var(--shadow-glow)]">
              <div className="hero-sheen rounded-[calc(1.5rem-1px)] p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="gradient-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-md">
                    <FileBarChart className="h-7 w-7" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      Generated from your latest data
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                        Student Readiness Report
                      </h2>
                      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                        A professionally formatted PDF you can share with mentors
                        or attach to applications. It is generated on demand from
                        your latest profile and prediction data.
                      </p>
                    </div>

                    <div className="pt-1">
                      <Button
                        variant="gradient"
                        size="lg"
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
              </div>
            </div>
          </motion.div>

          {/* What's inside */}
          <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
            <div className="surface-card h-full p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Contents
              </p>
              <h3 className="mb-4 mt-1 flex items-center gap-2 text-lg font-bold tracking-tight">
                <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                What&apos;s inside
              </h3>
              <ul className="space-y-3">
                {REPORT_CONTENTS.map((content) => (
                  <li
                    key={content}
                    className="flex items-start gap-2.5 text-sm text-muted-foreground"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <span>{content}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Tip */}
          <motion.div variants={itemVariants} className="lg:col-span-3">
            <div className="grid-backdrop surface-card flex items-start gap-3 p-4">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-cyan"
                aria-hidden="true"
              />
              <p className="text-xs text-muted-foreground">
                Tip: run a fresh prediction on your dashboard before downloading
                so the report reflects your most recent scores.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
