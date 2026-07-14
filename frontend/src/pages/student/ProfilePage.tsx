import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Trophy,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  ErrorState,
  GlassCard,
  PageHeader,
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
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
        {action}
      </div>
      {children}
    </GlassCard>
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

interface CrudListProps<TItem extends { id: number }, TValues, TPayload> {
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

function CrudList<TItem extends { id: number }, TValues, TPayload>({
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
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border bg-card/50 p-3"
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
            </li>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Keep your academic record, skills and experience up to date for the most accurate predictions."
      />

      {meQuery.isError ? (
        <ErrorState onRetry={() => void meQuery.refetch()} />
      ) : meQuery.isLoading || !student ? (
        <ProfileSkeleton />
      ) : (
        <>
          <ProfileForm student={student} />

          <div className="grid gap-6 lg:grid-cols-2">
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
          </div>
        </>
      )}
    </div>
  );
}
