import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileUp,
  GraduationCap,
  Loader2,
  Lightbulb,
  Sparkles,
  UploadCloud,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  GlassCard,
  PageHeader,
  ScoreRing,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { resumeApi } from "@/lib/api";
import { cn, formatDateTime, getApiErrorMessage } from "@/lib/utils";
import type { ResumeAnalysis } from "@/types";

import { studentKeys, useLatestResume, useMe } from "@/pages/student/use-student";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

// ---------------------------------------------------------------------------
// Chip group
// ---------------------------------------------------------------------------

function ChipGroup({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: LucideIcon;
  items: string[];
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
        <span className="text-xs font-normal text-muted-foreground">
          ({items.length})
        </span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing detected.</p>
      ) : (
        <motion.div
          className="flex flex-wrap gap-1.5"
          variants={listContainer}
          initial="hidden"
          animate="show"
        >
          {items.map((item, index) => (
            <motion.span key={`${item}-${index}`} variants={listItem}>
              <Badge variant="secondary" className="font-normal">
                {item}
              </Badge>
            </motion.span>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analysis result view
// ---------------------------------------------------------------------------

function AnalysisResult({
  analysis,
  heading,
}: {
  analysis: ResumeAnalysis;
  heading: string;
}) {
  return (
    <div className="space-y-6">
      <GlassCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold leading-tight">{heading}</h3>
            <p className="text-xs text-muted-foreground">
              {analysis.filename} · {formatDateTime(analysis.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-around gap-6">
          <ScoreRing value={analysis.resume_score} label="Resume Score" />
          <ScoreRing value={analysis.ats_score} label="ATS Score" />
        </div>
      </GlassCard>

      <GlassCard className="space-y-5 p-5">
        <h3 className="text-base font-semibold">Extracted content</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <ChipGroup title="Skills" icon={Sparkles} items={analysis.extracted.skills} />
          <ChipGroup
            title="Projects"
            icon={FileText}
            items={analysis.extracted.projects}
          />
          <ChipGroup
            title="Experience"
            icon={Wrench}
            items={analysis.extracted.experience}
          />
          <ChipGroup
            title="Education"
            icon={GraduationCap}
            items={analysis.extracted.education}
          />
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-base font-semibold">
            <AlertTriangle
              className="h-4 w-4 text-amber-500"
              aria-hidden="true"
            />
            Missing sections
          </h3>
          {analysis.missing_sections.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              All key sections are present.
            </div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {analysis.missing_sections.map((section) => (
                <li key={section}>
                  <Badge variant="warning" className="capitalize">
                    {section}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-base font-semibold">
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
            Suggestions
          </h3>
          {analysis.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No suggestions — your resume looks strong.
            </p>
          ) : (
            <ul className="space-y-2">
              {analysis.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag-and-drop uploader
// ---------------------------------------------------------------------------

function Uploader({
  studentId,
  onAnalyzed,
}: {
  studentId: number;
  onAnalyzed: (analysis: ResumeAnalysis) => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => resumeApi.upload(file),
    onSuccess: (analysis) => {
      void queryClient.invalidateQueries({ queryKey: studentKeys.me });
      queryClient.setQueryData(
        studentKeys.latestResume(studentId),
        analysis,
      );
      void queryClient.invalidateQueries({
        queryKey: studentKeys.latestResume(studentId),
      });
      onAnalyzed(analysis);
      setSelectedFile(null);
      toast.success("Resume analysed successfully.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not analyse the resume."));
    },
  });

  const validateAndSet = useCallback((file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File is too large — the maximum size is 5MB.");
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) validateAndSet(file);
  };

  const handleDrag = (event: DragEvent<HTMLDivElement>, active: boolean) => {
    event.preventDefault();
    setDragActive(active);
  };

  return (
    <GlassCard className="p-5">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF resume"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => handleDrag(event, true)}
        onDragEnter={(event) => handleDrag(event, true)}
        onDragLeave={(event) => handleDrag(event, false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-accent/40",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) validateAndSet(file);
            event.target.value = "";
          }}
        />
        <span className="gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold">
            Drag &amp; drop your resume here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF only · up to 5MB
          </p>
        </div>
      </div>

      {selectedFile && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/50 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Clear selected file"
              disabled={mutation.isPending}
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="gradient"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(selectedFile)}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <FileUp aria-hidden="true" />
              )}
              {mutation.isPending ? "Analysing…" : "Analyse resume"}
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ResumePage() {
  const meQuery = useMe();
  const studentId = meQuery.data?.id;
  const latestResume = useLatestResume(studentId);

  // A just-uploaded analysis takes precedence over the fetched "latest".
  const [freshAnalysis, setFreshAnalysis] = useState<ResumeAnalysis | null>(null);
  const shown = freshAnalysis ?? latestResume.data ?? null;

  if (meQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resume Analysis" />
        <ErrorState onRetry={() => void meQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume Analysis"
        description="Upload your resume as a PDF for an instant readiness and ATS score, extracted content, and actionable suggestions."
      />

      {meQuery.isLoading || !studentId ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : (
        <Uploader studentId={studentId} onAnalyzed={setFreshAnalysis} />
      )}

      {latestResume.isLoading && studentId ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      ) : shown ? (
        <AnalysisResult
          analysis={shown}
          heading={freshAnalysis ? "Latest analysis" : "Previous analysis"}
        />
      ) : (
        !latestResume.isLoading && (
          <EmptyState
            icon={FileText}
            title="No resume analysed yet"
            description="Upload a PDF above to see your resume and ATS scores, extracted skills and projects, and tailored improvement suggestions."
          />
        )
      )}
    </div>
  );
}
