import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  AtSign,
  Eye,
  EyeOff,
  Hash,
  Loader2,
  Lock,
  User,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
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
import { useAuth } from "@/hooks/use-auth";
import { BATCHES, DEPARTMENTS, ROLE_HOME_ROUTES } from "@/lib/constants";
import { cn, getApiErrorMessage } from "@/lib/utils";
import type { RegisterPayload } from "@/types";

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const fieldStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fieldItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must be at most 100 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    register_number: z
      .string()
      .min(4, "Register number must be at least 4 characters")
      .max(24, "Register number must be at most 24 characters")
      .regex(
        /^[A-Za-z0-9-]+$/,
        "Only letters, digits and hyphens are allowed",
      ),
    department: z.enum(["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"], {
      required_error: "Select a department",
    }),
    batch: z
      .string({ required_error: "Select a batch" })
      .regex(/^\d{4}$/, "Select a batch"),
    semester: z
      .number({ required_error: "Select a semester" })
      .int()
      .min(1, "Semester must be between 1 and 8")
      .max(8, "Semester must be between 1 and 8"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirm_password: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

function RegisterPage() {
  const { user, isLoading, register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      register_number: "",
      batch: "",
      password: "",
      confirm_password: "",
    },
  });

  // Already signed in → straight to the role home.
  if (!isLoading && user) {
    return <Navigate to={ROLE_HOME_ROUTES[user.role]} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload: RegisterPayload = {
      email: values.email,
      password: values.password,
      full_name: values.full_name,
      register_number: values.register_number,
      department: values.department,
      batch: values.batch,
      semester: values.semester,
    };
    try {
      const authedUser = await registerAccount(payload);
      toast.success("Account created — welcome to VaniAI!");
      navigate(ROLE_HOME_ROUTES[authedUser.role], { replace: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Registration failed. Please try again."),
      );
    }
  });

  return (
    <AuthLayout
      title="Create your student account"
      description="Track your placement readiness and get AI-powered career guidance."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-white underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <motion.form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
        noValidate
        variants={fieldStagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fieldItem} className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <div className="group relative">
            <User
              className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
              aria-hidden="true"
            />
            <Input
              id="full_name"
              autoComplete="name"
              placeholder="Priya Sharma"
              aria-invalid={Boolean(errors.full_name)}
              className={cn(
                "h-11 rounded-xl pl-10 shadow-sm transition-shadow focus-visible:shadow-glow",
                errors.full_name && "border-destructive/60",
              )}
              {...register("full_name")}
            />
          </div>
          <FieldError message={errors.full_name?.message} />
        </motion.div>

        <motion.div variants={fieldItem} className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="group relative">
            <AtSign
              className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@college.edu"
              aria-invalid={Boolean(errors.email)}
              className={cn(
                "h-11 rounded-xl pl-10 shadow-sm transition-shadow focus-visible:shadow-glow",
                errors.email && "border-destructive/60",
              )}
              {...register("email")}
            />
          </div>
          <FieldError message={errors.email?.message} />
        </motion.div>

        <motion.div variants={fieldItem} className="space-y-1.5">
          <Label htmlFor="register_number">Register number</Label>
          <div className="group relative">
            <Hash
              className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
              aria-hidden="true"
            />
            <Input
              id="register_number"
              placeholder="21CSE001"
              aria-invalid={Boolean(errors.register_number)}
              className={cn(
                "h-11 rounded-xl pl-10 shadow-sm transition-shadow focus-visible:shadow-glow",
                errors.register_number && "border-destructive/60",
              )}
              {...register("register_number")}
            />
          </div>
          <FieldError message={errors.register_number?.message} />
        </motion.div>

        <motion.div variants={fieldItem} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Controller
              control={control}
              name="department"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="department"
                    aria-invalid={Boolean(errors.department)}
                    className={cn(
                      "h-11 rounded-xl shadow-sm",
                      errors.department && "border-destructive/60",
                    )}
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.department?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch">Batch</Label>
            <Controller
              control={control}
              name="batch"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="batch"
                    aria-invalid={Boolean(errors.batch)}
                    className={cn(
                      "h-11 rounded-xl shadow-sm",
                      errors.batch && "border-destructive/60",
                    )}
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {BATCHES.map((batch) => (
                      <SelectItem key={batch} value={batch}>
                        {batch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.batch?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="semester">Semester</Label>
            <Controller
              control={control}
              name="semester"
              render={({ field }) => (
                <Select
                  value={field.value !== undefined ? String(field.value) : ""}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger
                    id="semester"
                    aria-invalid={Boolean(errors.semester)}
                    className={cn(
                      "h-11 rounded-xl shadow-sm",
                      errors.semester && "border-destructive/60",
                    )}
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map((semester) => (
                      <SelectItem key={semester} value={String(semester)}>
                        {semester}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.semester?.message} />
          </div>
        </motion.div>

        <motion.div variants={fieldItem} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="group relative">
              <Lock
                className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
                aria-hidden="true"
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className={cn(
                  "h-11 rounded-xl pl-10 pr-10 shadow-sm transition-shadow focus-visible:shadow-glow",
                  errors.password && "border-destructive/60",
                )}
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <FieldError message={errors.password?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm password</Label>
            <div className="group relative">
              <Lock
                className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
                aria-hidden="true"
              />
              <Input
                id="confirm_password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat password"
                aria-invalid={Boolean(errors.confirm_password)}
                className={cn(
                  "h-11 rounded-xl pl-10 shadow-sm transition-shadow focus-visible:shadow-glow",
                  errors.confirm_password && "border-destructive/60",
                )}
                {...register("confirm_password")}
              />
            </div>
            <FieldError message={errors.confirm_password?.message} />
          </div>
        </motion.div>

        <motion.div variants={fieldItem} className="pt-1">
          <Button
            type="submit"
            variant="gradient"
            className="h-11 w-full rounded-xl text-sm font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus aria-hidden="true" />
            )}
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </motion.div>
      </motion.form>
    </AuthLayout>
  );
}

export default RegisterPage;
