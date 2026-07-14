import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn, Sparkles } from "lucide-react";
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
import { getApiErrorMessage } from "@/lib/utils";

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
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@vaniai.io"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
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
        </div>

        <Button
          type="submit"
          variant="gradient"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <LogIn aria-hidden="true" />
          )}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <Separator className="my-5" />

      {/* Demo credentials hint — the four accounts created by seed.py */}
      <div className="rounded-xl border border-dashed bg-muted/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Demo accounts — click to autofill
        </p>
        <div className="space-y-1">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemoAccount(account.email, account.password)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
            >
              <span className="font-medium">{ROLE_LABELS[account.role]}</span>
              <span className="truncate font-mono text-muted-foreground">
                {account.email} / {account.password}
              </span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
