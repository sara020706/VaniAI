import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Lightbulb, Search, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
  RiskBadge,
  ScoreRing,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { facultyApi, studentApi } from "@/lib/api";
import { cn, getApiErrorMessage } from "@/lib/utils";
import type {
  ConfidenceLevel,
  InterviewScoreResult,
  StudentListItem,
} from "@/types";

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["low", "medium", "high"];

const interviewSchema = z.object({
  mock_interview_score: z
    .number({ invalid_type_error: "Enter a score" })
    .min(0, "Minimum is 0")
    .max(100, "Maximum is 100"),
  confidence_level: z.enum(["low", "medium", "high"]),
  notes: z.string().max(1000, "Keep notes under 1000 characters").optional(),
});

type InterviewFormValues = z.infer<typeof interviewSchema>;

/** Debounce a rapidly-changing value (e.g. a search box). */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Record a mock-interview assessment for a chosen student. The form is
 * validated with zod; on submit it posts to the faculty API and shows the
 * derived interview-readiness score, confidence and suggestions.
 */
export default function FacultyInterviewScoresPage() {
  const [searchInput, setSearchInput] = useState<string>("");
  const [selected, setSelected] = useState<StudentListItem | null>(null);
  const [result, setResult] = useState<InterviewScoreResult | null>(null);

  const search = useDebouncedValue(searchInput, 350);

  const searchQuery = useQuery({
    queryKey: ["faculty", "interview-search", search],
    queryFn: () =>
      studentApi.list({
        page: 1,
        page_size: 8,
        search: search.trim() ? search.trim() : undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InterviewFormValues>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      mock_interview_score: 70,
      confidence_level: "medium",
      notes: "",
    },
  });

  const submit = useMutation({
    mutationFn: (values: InterviewFormValues) => {
      if (!selected) {
        throw new Error("Select a student first.");
      }
      return facultyApi.submitInterviewScore({
        student_id: selected.id,
        mock_interview_score: values.mock_interview_score,
        confidence_level: values.confidence_level,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Interview score saved");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not save the score."));
    },
  });

  function selectStudent(student: StudentListItem) {
    setSelected(student);
    setResult(null);
    reset({
      mock_interview_score: 70,
      confidence_level: "medium",
      notes: "",
    });
  }

  const onSubmit = handleSubmit((values) => submit.mutate(values));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview Scores"
        description="Log mock-interview results and view the derived readiness score."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <Label
            htmlFor="interview-search"
            className="mb-1 block text-xs text-muted-foreground"
          >
            Select a student
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="interview-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or register number"
              className="pl-9"
            />
          </div>

          <div className="mt-4">
            {searchQuery.isLoading ? (
              <LoadingState label="Searching…" />
            ) : searchQuery.isError ? (
              <ErrorState onRetry={() => void searchQuery.refetch()} />
            ) : (searchQuery.data?.items.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No students match your search.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {searchQuery.data?.items.map((student) => {
                  const isSelected = selected?.id === student.id;
                  return (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => selectStudent(student)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                          isSelected ? "bg-accent/60" : "hover:bg-accent/40",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {student.full_name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {student.register_number} · {student.department}
                          </span>
                        </span>
                        {isSelected && (
                          <Check
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          {selected ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Recording for</p>
                <p className="font-semibold">{selected.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.register_number} · {selected.department} · Batch{" "}
                  {selected.batch}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mock_interview_score">
                  Mock Interview Score (0–100)
                </Label>
                <Input
                  id="mock_interview_score"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  {...register("mock_interview_score", { valueAsNumber: true })}
                  aria-invalid={Boolean(errors.mock_interview_score)}
                />
                {errors.mock_interview_score && (
                  <p className="text-xs text-destructive">
                    {errors.mock_interview_score.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confidence_level">Confidence Level</Label>
                <Controller
                  control={control}
                  name="confidence_level"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="confidence_level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONFIDENCE_LEVELS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.confidence_level && (
                  <p className="text-xs text-destructive">
                    {errors.confidence_level.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Observations, strengths, areas to improve…"
                  {...register("notes")}
                  aria-invalid={Boolean(errors.notes)}
                />
                {errors.notes && (
                  <p className="text-xs text-destructive">
                    {errors.notes.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="gradient"
                className="w-full"
                disabled={submit.isPending}
              >
                <Send aria-hidden="true" />
                {submit.isPending ? "Saving…" : "Submit Score"}
              </Button>
            </form>
          ) : (
            <EmptyState
              icon={Search}
              title="No student selected"
              description="Search for and select a student to record their interview score."
            />
          )}
        </GlassCard>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <GlassCard className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Interview Readiness</h2>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ScoreRing
                value={result.interview_readiness.score}
                label="Readiness"
                size={128}
              />
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Confidence
                  </span>
                  <RiskBadge
                    level={
                      result.interview_readiness.confidence_level === "high"
                        ? "low"
                        : result.interview_readiness.confidence_level === "medium"
                          ? "medium"
                          : "high"
                    }
                  />
                  <span className="text-xs capitalize text-muted-foreground">
                    ({result.interview_readiness.confidence_level})
                  </span>
                </div>
                {result.interview_readiness.suggestions.length > 0 ? (
                  <div>
                    <p className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                      <Lightbulb
                        className="h-4 w-4 text-primary"
                        aria-hidden="true"
                      />
                      Suggestions
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {result.interview_readiness.suggestions.map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No additional suggestions — solid interview performance.
                  </p>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
