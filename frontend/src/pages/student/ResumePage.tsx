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
import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
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
  show: { transition: { staggerChildren: 0.05 } },
};
const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
const chipContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};
const chipItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

// ---------------------------------------------------------------------------
// Section eyebrow — small uppercase label above a bold title (shared pattern).
// ---------------------------------------------------------------------------

function SectionEyebrow({
  eyebrow,
  title,
  icon: Icon,
  aside,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
          <h3 className="text-lg font-semibold leading-tight tracking-tight">
            {title}
          </h3>
        </div>
      </div>
      {aside}
    </div>
  );
}

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
    <div className="space-y-2.5 rounded-2xl border border-border/70 bg-card/60 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          ({items.length})
        </span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing detected.</p>
      ) : (
        <motion.div
          className="flex flex-wrap gap-1.5"
          variants={chipContainer}
          initial="hidden"
          animate="show"
        >
          {items.map((item, index) => (
            <motion.span key={`${item}-${index}`} variants={chipItem}>
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
    <motion.div
      className="space-y-6"
      variants={listContainer}
      initial="hidden"
      animate="show"
    >
      {/* Scores — the signature instrument, framed as an AI/insight card */}
      <motion.div variants={listItem}>
        <div className="gradient-border overflow-hidden">
          <div className="hero-sheen relative rounded-3xl p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {heading}
                </p>
                <h3 className="mt-1 text-lg font-semibold leading-tight tracking-tight">
                  Your resume, scored
                </h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {analysis.filename} · {formatDateTime(analysis.created_at)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-around gap-8">
              <div className="text-center">
                <ScoreRing value={analysis.resume_score} label="Resume Score" size={140} />
                <p className="mt-2 max-w-[10rem] text-xs text-muted-foreground">
                  Overall strength of your resume
                </p>
              </div>
              <div className="text-center">
                <ScoreRing value={analysis.ats_score} label="ATS Score" size={140} />
                <p className="mt-2 max-w-[10rem] text-xs text-muted-foreground">
                  How well it parses for applicant tracking systems
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Extracted content */}
      <motion.div variants={listItem}>
        <div className="surface-card p-6">
          <SectionEyebrow
            eyebrow="What we found"
            title="Extracted content"
            icon={FileText}
          />
          <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </motion.div>

      {/* Missing sections + suggestions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={listItem} whileHover={{ y: -2 }}>
          <div className="surface-card h-full p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
            <SectionEyebrow
              eyebrow="Coverage"
              title="Missing sections"
              icon={AlertTriangle}
            />
            {analysis.missing_sections.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                All key sections are present.
              </div>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {analysis.missing_sections.map((section) => (
                  <li key={section}>
                    <Badge variant="warning" className="capitalize">
                      {section}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>

        <motion.div variants={listItem} whileHover={{ y: -2 }}>
          <div className="gradient-border h-full">
            <div className="h-full rounded-3xl p-6">
              <SectionEyebrow
                eyebrow="Improve"
                title="Suggestions"
                icon={Lightbulb}
              />
              {analysis.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No suggestions — your resume looks strong.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analysis.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-sm leading-relaxed"
                    >
                      <Sparkles
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
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
    <div className="surface-card p-5 sm:p-6">
      <motion.div
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
        animate={{ scale: dragActive ? 1.01 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "grid-backdrop relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
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
        <motion.span
          className="gradient-primary flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
          animate={{ y: dragActive ? -4 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
        >
          <UploadCloud className="h-7 w-7" aria-hidden="true" />
        </motion.span>
        <div>
          <p className="text-base font-semibold">
            {dragActive
              ? "Drop to analyse your resume"
              : "Drag & drop your resume here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF only · up to 5MB
          </p>
        </div>
      </motion.div>

      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/60 p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
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
        </motion.div>
      )}
    </div>
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
        <Skeleton className="h-64 rounded-3xl" />
      ) : (
        <Uploader studentId={studentId} onAnalyzed={setFreshAnalysis} />
      )}

      {latestResume.isLoading && studentId ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
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
