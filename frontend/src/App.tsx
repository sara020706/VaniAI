import { GraduationCap } from "lucide-react";
import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_HOME_ROUTES } from "@/lib/constants";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import type { Role } from "@/types";

// ---------------------------------------------------------------------------
// Lazy role page groups (CONTRACTS.md §8.4 route table).
// Every feature page is a DEFAULT export at exactly these paths — pages are
// authored by the feature agents (F2/F3/F4) and resolve once they exist.
// ---------------------------------------------------------------------------

const StudentDashboardPage = lazy(() => import("@/pages/student/DashboardPage"));
const StudentProfilePage = lazy(() => import("@/pages/student/ProfilePage"));
const StudentResumePage = lazy(() => import("@/pages/student/ResumePage"));
const StudentProgressPage = lazy(() => import("@/pages/student/ProgressPage"));
const StudentReportsPage = lazy(() => import("@/pages/student/ReportsPage"));

const FacultyDashboardPage = lazy(() => import("@/pages/faculty/DashboardPage"));
const FacultyStudentsPage = lazy(() => import("@/pages/faculty/StudentsPage"));
const FacultyStudentDetailPage = lazy(
  () => import("@/pages/faculty/StudentDetailPage"),
);
const FacultyComparePage = lazy(() => import("@/pages/faculty/ComparePage"));
const FacultyInterviewScoresPage = lazy(
  () => import("@/pages/faculty/InterviewScoresPage"),
);

const PlacementDashboardPage = lazy(
  () => import("@/pages/placement/DashboardPage"),
);
const PlacementAtRiskPage = lazy(() => import("@/pages/placement/AtRiskPage"));
const PlacementDepartmentsPage = lazy(
  () => import("@/pages/placement/DepartmentsPage"),
);

const AdminDashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));
const AdminUsersPage = lazy(() => import("@/pages/admin/UsersPage"));
const AdminDatasetsPage = lazy(() => import("@/pages/admin/DatasetsPage"));
const AdminModelsPage = lazy(() => import("@/pages/admin/ModelsPage"));
const AdminMonitoringPage = lazy(() => import("@/pages/admin/MonitoringPage"));

// ---------------------------------------------------------------------------
// Loading placeholders
// ---------------------------------------------------------------------------

/** Full-screen splash shown while the session bootstraps from a stored token. */
function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="gradient-primary flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl text-white shadow-lg">
          <GraduationCap className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">Loading VaniAI…</p>
      </div>
    </div>
  );
}

/** Suspense fallback while a lazy page chunk loads — dashboard-shaped skeleton. */
function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route guards (CONTRACTS.md §8.4)
// ---------------------------------------------------------------------------

/** Renders children only for authenticated users; otherwise sends to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/**
 * Renders children only when the user's role is allowed; other authenticated
 * users are redirected to their own role home.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME_ROUTES[user.role]} replace />;
  }
  return <>{children}</>;
}

/** "/" and unknown paths → role home for signed-in users, /login otherwise. */
function RoleHomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME_ROUTES[user.role]} replace />;
}

/** Role-guarded layout route: lazy children share one Suspense boundary. */
function RoleGroup({ roles }: { roles: Role[] }) {
  return (
    <RequireRole roles={roles}>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </RequireRole>
  );
}

// ---------------------------------------------------------------------------
// App routes
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Authenticated shell */}
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        {/* Student */}
        <Route path="/student" element={<RoleGroup roles={["student"]} />}>
          <Route index element={<StudentDashboardPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
          <Route path="resume" element={<StudentResumePage />} />
          <Route path="progress" element={<StudentProgressPage />} />
          <Route path="reports" element={<StudentReportsPage />} />
        </Route>

        {/* Faculty — student lists/detail/compare are also readable by
            placement officers (mirrors backend §7 role annotations). */}
        <Route
          path="/faculty"
          element={
            <RoleGroup roles={["faculty", "placement_officer", "admin"]} />
          }
        >
          <Route
            index
            element={
              <RequireRole roles={["faculty", "admin"]}>
                <FacultyDashboardPage />
              </RequireRole>
            }
          />
          <Route path="students" element={<FacultyStudentsPage />} />
          <Route path="students/:id" element={<FacultyStudentDetailPage />} />
          <Route path="compare" element={<FacultyComparePage />} />
          <Route
            path="interviews"
            element={
              <RequireRole roles={["faculty", "admin"]}>
                <FacultyInterviewScoresPage />
              </RequireRole>
            }
          />
        </Route>

        {/* Placement officer */}
        <Route
          path="/placement"
          element={<RoleGroup roles={["placement_officer", "admin"]} />}
        >
          <Route index element={<PlacementDashboardPage />} />
          <Route path="at-risk" element={<PlacementAtRiskPage />} />
          <Route path="departments" element={<PlacementDepartmentsPage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<RoleGroup roles={["admin"]} />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="datasets" element={<AdminDatasetsPage />} />
          <Route path="models" element={<AdminModelsPage />} />
          <Route path="monitoring" element={<AdminMonitoringPage />} />
        </Route>
      </Route>

      {/* Home + fallback */}
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}
