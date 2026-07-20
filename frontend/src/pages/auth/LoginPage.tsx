import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import {
  DEMO_ACCOUNTS,
  ROLE_HOME_ROUTES,
  ROLE_LABELS,
} from "@/lib/constants";
import { cn, getApiErrorMessage } from "@/lib/utils";

const fieldStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fieldItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface RedirectState {
  from?: { pathname?: string };
}

function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Already signed in → straight to the role home.
  if (!isLoading && user) {
    return <Navigate to={ROLE_HOME_ROUTES[user.role]} replace />;
  }

  const redirectState = location.state as RedirectState | null;
  const from = redirectState?.from?.pathname;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const authedUser = await login(values.email, values.password);
      toast.success(`Welcome back, ${authedUser.full_name}!`);
      navigate(from ?? ROLE_HOME_ROUTES[authedUser.role], { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid email or password."));
    }
  });

  const fillDemoAccount = (email: string, password: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
    toast.info("Demo credentials filled — press Sign in.");
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your VaniAI account to continue."
      footer={
        <p>
          New student?{" "}
          <Link
            to="/register"
            className="font-semibold text-white underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <motion.form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-5"
        noValidate
        variants={fieldStagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fieldItem} className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="group relative">
            <Mail
              className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@vaniai.io"
              aria-invalid={Boolean(errors.email)}
              className={cn(
                "h-11 rounded-xl pl-10 shadow-sm transition-shadow focus-visible:shadow-glow",
                errors.email && "border-destructive/60",
              )}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </motion.div>

        <motion.div variants={fieldItem} className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="group relative">
            <Lock
              className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
              aria-hidden="true"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
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
          {errors.password && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </motion.div>

        <motion.div variants={fieldItem}>
          <Button
            type="submit"
            variant="gradient"
            className="h-11 w-full rounded-xl text-sm font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <LogIn aria-hidden="true" />
            )}
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </motion.div>
      </motion.form>

      <Separator className="my-6" />

      {/* Demo credentials hint — the four accounts created by seed.py */}
      <div className="gradient-border rounded-2xl p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Demo accounts — tap to autofill
        </p>
        <div className="grid gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <motion.button
              key={account.email}
              type="button"
              onClick={() => fillDemoAccount(account.email, account.password)}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/70 transition-colors group-hover:bg-primary" />
                {ROLE_LABELS[account.role]}
              </span>
              <span className="flex items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground">
                {account.email}
                <ArrowRight
                  className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
