import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";

import { GlassCard } from "@/components/shared/GlassCard";

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Rendered under the card (e.g. a link to the other auth page). */
  footer?: ReactNode;
}

/**
 * Auth shell: centered glass card floating over an animated brand-gradient
 * background with soft light blobs.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="auth-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Decorative floating blobs */}
      <div
        className="animate-float-blob pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="animate-float-blob pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-teal-300/25 blur-3xl"
        style={{ animationDelay: "-8s" }}
        aria-hidden="true"
      />
      {/* Fine dotted texture for depth */}
      <div
        className="grid-backdrop pointer-events-none absolute inset-0 opacity-[0.15]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md">
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              VaniAI
            </h1>
            <p className="text-sm text-white/80">
              AI-powered placement prediction &amp; career readiness
            </p>
          </div>
        </div>

        <GlassCard className="hero-sheen p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {children}
        </GlassCard>

        {footer && (
          <div className="mt-4 text-center text-sm text-white/90">{footer}</div>
        )}
      </div>
    </div>
  );
}

export default AuthLayout;
