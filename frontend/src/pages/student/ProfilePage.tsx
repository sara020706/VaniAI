import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Award,
  Briefcase,
  Code2,
  ExternalLink,
  FolderGit2,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trophy,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  ErrorState,
  GlassCard,
  PageHeader,
  StatCard,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { studentApi } from "@/lib/api";
import { DEPARTMENTS } from "@/lib/constants";
import { formatDate, getApiErrorMessage } from "@/lib/utils";
import type {
  Certification,
  CertificationPayload,
  Department,
  Hackathon,
  HackathonPayload,
  Internship,
  InternshipPayload,
  Project,
  ProjectPayload,
  Student,
} from "@/types";

import { studentKeys, useMe } from "@/pages/student/use-student";

// ---------------------------------------------------------------------------
// Entrance motion — card stagger shared across the page sections.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Profile form (personal + academic + skills) — matches backend ranges.
// ---------------------------------------------------------------------------

const scoreField = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} must be at least 0`)
    .max(100, `${label} must be at most 100`);

const percentField = scoreField;

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(120),
  department: z.enum(["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"]),
  batch: z
    .string()
    .regex(/^\d{4}$/, "Batch must be a 4-digit year"),
  semester: z.coerce
    .number({ invalid_type_error: "Semester must be a number" })
    .int("Semester must be a whole number")
    .min(1, "Semester must be at least 1")
    .max(12, "Semester must be at most 12"),
  cgpa: z.coerce
    .number({ invalid_type_error: "CGPA must be a number" })
    .min(0, "CGPA must be at least 0")
    .max(10, "CGPA must be at most 10"),
  tenth_percentage: percentField("10th percentage"),
  twelfth_percentage: percentField("12th percentage"),
  attendance_percentage: percentField("Attendance"),
  coding_score: scoreField("Coding score"),
  aptitude_score: scoreField("Aptitude score"),
  communication_score: scoreField("Communication score"),
  technical_skill_score: scoreField("Technical skill score"),
  leadership_score: scoreField("Leadership score"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function toDefaults(student: Student): ProfileFormValues {
  return {
    full_name: student.full_name,
    department: student.department,
    batch: student.batch,
    semester: student.semester,
    cgpa: student.academic.cgpa ?? 0,
    tenth_percentage: student.academic.tenth_percentage ?? 0,
    twelfth_percentage: student.academic.twelfth_percentage ?? 0,
    attendance_percentage: student.academic.attendance_percentage ?? 0,
    coding_score: student.skills.coding_score ?? 0,
    aptitude_score: student.skills.aptitude_score ?? 0,
    communication_score: student.skills.communication_score ?? 0,
    technical_skill_score: student.skills.technical_skill_score ?? 0,
    leadership_score: student.skills.leadership_score ?? 0,
  };
}

interface FieldProps {
  id: keyof ProfileFormValues;
  label: string;
  register: ReturnType<typeof useForm<ProfileFormValues>>["register"];
  error?: string;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
}

function NumberField({ id, label, register, error, step, min, max }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step ?? "0.1"}
        min={min}
        max={max}
        aria-invalid={Boolean(error)}
        {...register(id, { valueAsNumber: true })}
      />
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ProfileForm({ student }: { student: Student }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormValues>,
    defaultValues: toDefaults(student),
  });

  // Keep the form in sync if the underlying profile changes (e.g. after a
  // prediction re-fetch) while there are no unsaved local edits.
  useEffect(() => {
    reset(toDefaults(student));
  }, [student, reset]);

  const department = watch("department");

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => studentApi.updateMe(values),
    onSuccess: (updated) => {
      queryClient.setQueryData(studentKeys.me, updated);
      void queryClient.invalidateQueries({ queryKey: studentKeys.me });
      void queryClient.invalidateQueries({
        queryKey: studentKeys.progress(updated.id),
      });
      reset(toDefaults(updated));
      toast.success("Profile updated.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not save your profile."));
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-6" noValidate>
      <SectionCard title="Personal" icon={UserRound}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              aria-invalid={Boolean(errors.full_name)}
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-xs font-medium text-destructive" role="alert">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Select
              value={department}
              onValueChange={(value) =>
                setValue("department", value as Department, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="department" aria-invalid={Boolean(errors.department)}>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.department && (
              <p className="text-xs font-medium text-destructive" role="alert">
                {errors.department.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch">Batch (year)</Label>
            <Input
              id="batch"
              inputMode="numeric"
              placeholder="2026"
              aria-invalid={Boolean(errors.batch)}
              {...register("batch")}
            />
            {errors.batch && (
              <p className="text-xs font-medium text-destructive" role="alert">
                {errors.batch.message}
              </p>
            )}
          </div>

          <NumberField
            id="semester"
            label="Semester"
            register={register}
            error={errors.semester?.message}
            step="1"
            min={1}
            max={12}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Register number{" "}
          <span className="font-mono font-medium text-foreground">
            {student.register_number}
          </span>{" "}
          and email{" "}
          <span className="font-medium text-foreground">{student.email}</span> are
          managed by your institution and cannot be changed here.
        </p>
      </SectionCard>

      <SectionCard
        title="Academic"
        icon={GraduationCap}
        description="CGPA is out of 10; percentages are out of 100."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            id="cgpa"
            label="CGPA (0–10)"
            register={register}
            error={errors.cgpa?.message}
            step="0.01"
            min={0}
            max={10}
          />
          <NumberField
            id="tenth_percentage"
            label="10th %"
            register={register}
            error={errors.tenth_percentage?.message}
            min={0}
            max={100}
          />
          <NumberField
            id="twelfth_percentage"
            label="12th %"
            register={register}
            error={errors.twelfth_percentage?.message}
            min={0}
            max={100}
          />
          <NumberField
            id="attendance_percentage"
            label="Attendance %"
            register={register}
            error={errors.attendance_percentage?.message}
            min={0}
            max={100}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Skills"
        icon={Code2}
        description="Self-assessed scores out of 100."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            id="coding_score"
            label="Coding"
            register={register}
            error={errors.coding_score?.message}
            min={0}
            max={100}
          />
          <NumberField
            id="aptitude_score"
            label="Aptitude"
            register={register}
            error={errors.aptitude_score?.message}
            min={0}
            max={100}
          />
          <NumberField
            id="communication_score"
            label="Communication"
            register={register}
            error={errors.communication_score?.message}
            min={0}
            max={100}
          />
          <NumberField
            id="technical_skill_score"
            label="Technical skill"
            register={register}
            error={errors.technical_skill_score?.message}
            min={0}
            max={100}
          />
          <NumberField
            id="leadership_score"
            label="Leadership"
            register={register}
            error={errors.leadership_score?.message}
            min={0}
            max={100}
          />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="gradient"
          disabled={mutation.isPending || !isDirty}
        >
          {mutation.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card h-full rounded-3xl p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic CRUD list with add-dialog + delete
// ---------------------------------------------------------------------------

interface CrudFieldSpec<TValues> {
  name: keyof TValues & string;
  label: string;
  type?: "text" | "number" | "date" | "textarea";
  placeholder?: string;
  optional?: boolean;
}

interface CrudListProps<TItem extends { id: number }, TValues extends FieldValues, TPayload> {
  title: string;
  icon: LucideIcon;
  items: TItem[];
  fields: CrudFieldSpec<TValues>[];
  schema: z.ZodTypeAny;
  defaults: TValues;
  toPayload: (values: TValues) => TPayload;
  addFn: (payload: TPayload) => Promise<TItem>;
  deleteFn: (id: number) => Promise<void>;
  renderItem: (item: TItem) => ReactNode;
  emptyLabel: string;
  singular: string;
}

function CrudList<TItem extends { id: number }, TValues extends FieldValues, TPayload>({
  title,
  icon,
  items,
  fields,
  schema,
  defaults,
  toPayload,
  addFn,
  deleteFn,
  renderItem,
  emptyLabel,
  singular,
}: CrudListProps<TItem, TValues, TPayload>) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TValues>({
    resolver: zodResolver(schema) as Resolver<TValues>,
    defaultValues: defaults as never,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: studentKeys.me });

  const addMutation = useMutation({
    mutationFn: (values: TValues) => addFn(toPayload(values)),
    onSuccess: () => {
      void invalidate();
      toast.success(`${singular} added.`);
      reset(defaults as never);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, `Could not add ${singular.toLowerCase()}.`));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFn(id),
    onMutate: (id: number) => setDeletingId(id),
    onSuccess: () => {
      void invalidate();
      toast.success(`${singular} removed.`);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, `Could not remove ${singular.toLowerCase()}.`),
      );
    },
    onSettled: () => setDeletingId(null),
  });

  const onSubmit = handleSubmit((values) => addMutation.mutate(values));

  const errorFor = (name: string): string | undefined => {
    const entry = (errors as Record<string, { message?: string } | undefined>)[name];
    return entry?.message;
  };

  return (
    <SectionCard
      title={title}
      icon={icon}
      action={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            reset(defaults as never);
            setOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          Add
        </Button>
      }
    >
      {items.length === 0 ? (
        <div className="grid-backdrop flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
            {(() => {
              const EmptyIcon = icon;
              return <EmptyIcon className="h-5 w-5" aria-hidden="true" />;
            })()}
          </span>
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              reset(defaults as never);
              setOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            Add {singular.toLowerCase()}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <motion.li
              key={item.id}
              variants={itemVariants}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="flex items-start justify-between gap-3 rounded-2xl border bg-card/60 p-4 transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <div className="min-w-0">{renderItem(item)}</div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${singular.toLowerCase()}`}
                disabled={deleteMutation.isPending && deletingId === item.id}
                onClick={() => deleteMutation.mutate(item.id)}
              >
                {deleteMutation.isPending && deletingId === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </motion.li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {singular.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Fill in the details below and save to add it to your profile.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void onSubmit(event)}
            className="space-y-4"
            noValidate
          >
            {fields.map((field) => {
              const message = errorFor(field.name);
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={`add-${field.name}`}>
                    {field.label}
                    {field.optional && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                      </span>
                    )}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={`add-${field.name}`}
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(message)}
                      {...register(field.name as never)}
                    />
                  ) : (
                    <Input
                      id={`add-${field.name}`}
                      type={field.type === "number" ? "number" : field.type ?? "text"}
                      step={field.type === "number" ? "1" : undefined}
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(message)}
                      {...register(
                        field.name as never,
                        field.type === "number"
                          ? { valueAsNumber: true }
                          : undefined,
                      )}
                    />
                  )}
                  {message && (
                    <p className="text-xs font-medium text-destructive" role="alert">
                      {message}
                    </p>
                  )}
                </div>
              );
            })}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="gradient" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Sub-resource schemas
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  tech_stack: z.string().min(1, "Tech stack is required"),
  description: z.string().min(1, "Description is required"),
  url: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .or(z.literal(""))
    .optional(),
});
type ProjectFormValues = z.infer<typeof projectSchema>;

const internshipSchema = z.object({
  company: z.string().min(1, "Company is required"),
  role: z.string().min(1, "Role is required"),
  duration_months: z.coerce
    .number({ invalid_type_error: "Duration must be a number" })
    .int("Duration must be a whole number")
    .min(1, "Duration must be at least 1 month")
    .max(60, "Duration seems too long"),
  description: z.string().optional(),
});
type InternshipFormValues = z.infer<typeof internshipSchema>;

const certificationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  issuer: z.string().min(1, "Issuer is required"),
  issued_date: z.string().optional(),
  credential_url: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .or(z.literal(""))
    .optional(),
});
type CertificationFormValues = z.infer<typeof certificationSchema>;

const hackathonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().optional(),
  event_date: z.string().optional(),
});
type HackathonFormValues = z.infer<typeof hackathonSchema>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-56 rounded-2xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const meQuery = useMe();
  const student = meQuery.data;

  const initials = student
    ? student.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Profile"
        description="Keep your academic record, skills and experience up to date for the most accurate predictions."
      />

      {meQuery.isError ? (
        <ErrorState onRetry={() => void meQuery.refetch()} />
      ) : meQuery.isLoading || !student ? (
        <ProfileSkeleton />
      ) : (
        <motion.div
          className="space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Identity strip */}
          <motion.div variants={itemVariants}>
            <GlassCard className="hero-sheen relative overflow-hidden rounded-3xl p-6 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="gradient-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-[var(--shadow-glow)]"
                  >
                    {initials || <UserRound className="h-7 w-7" />}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold tracking-tight">
                      {student.full_name}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-mono font-medium text-foreground">
                        {student.register_number}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{student.email}</span>
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Badge variant="secondary">{student.department}</Badge>
                      <Badge variant="secondary">Batch {student.batch}</Badge>
                      <Badge variant="secondary">
                        Semester {student.semester}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Portfolio at a glance */}
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <StatCard
                title="CGPA"
                value={
                  student.academic.cgpa != null
                    ? student.academic.cgpa.toFixed(2)
                    : "—"
                }
                icon={GraduationCap}
                gradient
                description="Out of 10"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Projects"
                value={student.experience.projects.length}
                icon={FolderGit2}
                description="In your portfolio"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Internships"
                value={student.experience.internships.length}
                icon={Briefcase}
                description="Work experience"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Certifications"
                value={student.experience.certifications.length}
                icon={Award}
                description="Credentials earned"
              />
            </motion.div>
          </motion.div>

          {/* Editable profile */}
          <motion.section className="space-y-4" variants={containerVariants}>
            <div className="flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 text-electric"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Your record
                </p>
                <h2 className="text-lg font-bold tracking-tight">
                  Details that drive your prediction
                </h2>
              </div>
            </div>
            <ProfileForm student={student} />
          </motion.section>

          {/* Experience */}
          <motion.section className="space-y-4" variants={containerVariants}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Portfolio
              </p>
              <h2 className="text-lg font-bold tracking-tight">
                Projects &amp; achievements
              </h2>
            </div>
            <motion.div
              className="grid gap-6 lg:grid-cols-2"
              variants={containerVariants}
            >
            <motion.div variants={itemVariants}>
            <CrudList<Project, ProjectFormValues, ProjectPayload>
              title="Projects"
              icon={FolderGit2}
              items={student.experience.projects}
              schema={projectSchema}
              defaults={{ title: "", tech_stack: "", description: "", url: "" }}
              fields={[
                { name: "title", label: "Title", placeholder: "Placement Predictor" },
                {
                  name: "tech_stack",
                  label: "Tech stack",
                  placeholder: "React, FastAPI, PostgreSQL",
                },
                {
                  name: "description",
                  label: "Description",
                  type: "textarea",
                  placeholder: "What the project does and your role.",
                },
                {
                  name: "url",
                  label: "URL",
                  placeholder: "https://github.com/…",
                  optional: true,
                },
              ]}
              toPayload={(values) => ({
                title: values.title,
                tech_stack: values.tech_stack,
                description: values.description,
                url: emptyToNull(values.url),
              })}
              addFn={(payload) => studentApi.addProject(payload)}
              deleteFn={(id) => studentApi.deleteProject(id)}
              emptyLabel="No projects added yet."
              singular="Project"
              renderItem={(project) => (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{project.title}</p>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Link <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {project.tech_stack}
                  </p>
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </>
              )}
            />

            </motion.div>

            <motion.div variants={itemVariants}>
            <CrudList<Internship, InternshipFormValues, InternshipPayload>
              title="Internships"
              icon={Briefcase}
              items={student.experience.internships}
              schema={internshipSchema}
              defaults={{ company: "", role: "", duration_months: 1, description: "" }}
              fields={[
                { name: "company", label: "Company", placeholder: "Acme Corp" },
                { name: "role", label: "Role", placeholder: "Software Intern" },
                {
                  name: "duration_months",
                  label: "Duration (months)",
                  type: "number",
                },
                {
                  name: "description",
                  label: "Description",
                  type: "textarea",
                  optional: true,
                },
              ]}
              toPayload={(values) => ({
                company: values.company,
                role: values.role,
                duration_months: values.duration_months,
                description: emptyToNull(values.description),
              })}
              addFn={(payload) => studentApi.addInternship(payload)}
              deleteFn={(id) => studentApi.deleteInternship(id)}
              emptyLabel="No internships added yet."
              singular="Internship"
              renderItem={(internship) => (
                <>
                  <p className="font-medium">
                    {internship.role}{" "}
                    <span className="font-normal text-muted-foreground">
                      @ {internship.company}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {internship.duration_months}{" "}
                    {internship.duration_months === 1 ? "month" : "months"}
                  </p>
                  {internship.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {internship.description}
                    </p>
                  )}
                </>
              )}
            />

            </motion.div>

            <motion.div variants={itemVariants}>
            <CrudList<Certification, CertificationFormValues, CertificationPayload>
              title="Certifications"
              icon={Award}
              items={student.experience.certifications}
              schema={certificationSchema}
              defaults={{ name: "", issuer: "", issued_date: "", credential_url: "" }}
              fields={[
                {
                  name: "name",
                  label: "Name",
                  placeholder: "AWS Cloud Practitioner",
                },
                { name: "issuer", label: "Issuer", placeholder: "Amazon Web Services" },
                {
                  name: "issued_date",
                  label: "Issued date",
                  type: "date",
                  optional: true,
                },
                {
                  name: "credential_url",
                  label: "Credential URL",
                  placeholder: "https://…",
                  optional: true,
                },
              ]}
              toPayload={(values) => ({
                name: values.name,
                issuer: values.issuer,
                issued_date: emptyToNull(values.issued_date),
                credential_url: emptyToNull(values.credential_url),
              })}
              addFn={(payload) => studentApi.addCertification(payload)}
              deleteFn={(id) => studentApi.deleteCertification(id)}
              emptyLabel="No certifications added yet."
              singular="Certification"
              renderItem={(cert) => (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{cert.name}</p>
                    {cert.credential_url && (
                      <a
                        href={cert.credential_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Verify <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cert.issuer}
                    {cert.issued_date ? ` · ${formatDate(cert.issued_date)}` : ""}
                  </p>
                </>
              )}
            />

            </motion.div>

            <motion.div variants={itemVariants}>
            <CrudList<Hackathon, HackathonFormValues, HackathonPayload>
              title="Hackathons"
              icon={Trophy}
              items={student.experience.hackathons}
              schema={hackathonSchema}
              defaults={{ name: "", position: "", event_date: "" }}
              fields={[
                { name: "name", label: "Name", placeholder: "Smart India Hackathon" },
                {
                  name: "position",
                  label: "Position",
                  placeholder: "Winner / Finalist",
                  optional: true,
                },
                {
                  name: "event_date",
                  label: "Event date",
                  type: "date",
                  optional: true,
                },
              ]}
              toPayload={(values) => ({
                name: values.name,
                position: emptyToNull(values.position),
                event_date: emptyToNull(values.event_date),
              })}
              addFn={(payload) => studentApi.addHackathon(payload)}
              deleteFn={(id) => studentApi.deleteHackathon(id)}
              emptyLabel="No hackathons added yet."
              singular="Hackathon"
              renderItem={(hack) => (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{hack.name}</p>
                    {hack.position && (
                      <Badge variant="secondary">{hack.position}</Badge>
                    )}
                  </div>
                  {hack.event_date && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(hack.event_date)}
                    </p>
                  )}
                </>
              )}
            />
            </motion.div>
            </motion.div>
          </motion.section>
        </motion.div>
      )}
    </div>
  );
}
