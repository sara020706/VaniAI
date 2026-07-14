import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  ChevronLeft,
  ClipboardList,
  Database,
  FileText,
  GitCompareArrows,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ROLE_LABELS } from "@/lib/constants";
import { cn, getInitials } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Exact-match highlighting (index routes). */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  // student
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, roles: ["student"], end: true },
  { to: "/student/profile", label: "Profile", icon: UserRound, roles: ["student"] },
  { to: "/student/resume", label: "Resume", icon: FileText, roles: ["student"] },
  { to: "/student/progress", label: "Progress", icon: TrendingUp, roles: ["student"] },
  { to: "/student/reports", label: "Reports", icon: ClipboardList, roles: ["student"] },
  // faculty
  { to: "/faculty", label: "Dashboard", icon: LayoutDashboard, roles: ["faculty"], end: true },
  { to: "/faculty/students", label: "Students", icon: Users, roles: ["faculty"] },
  { to: "/faculty/compare", label: "Compare", icon: GitCompareArrows, roles: ["faculty"] },
  { to: "/faculty/interviews", label: "Interviews", icon: ClipboardList, roles: ["faculty"] },
  // placement officer
  { to: "/placement", label: "Dashboard", icon: LayoutDashboard, roles: ["placement_officer"], end: true },
  { to: "/placement/at-risk", label: "At-Risk Students", icon: AlertTriangle, roles: ["placement_officer"] },
  { to: "/placement/departments", label: "Departments", icon: Building2, roles: ["placement_officer"] },
  // admin
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"], end: true },
  { to: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
  { to: "/admin/datasets", label: "Datasets", icon: Database, roles: ["admin"] },
  { to: "/admin/models", label: "Models", icon: Boxes, roles: ["admin"] },
  { to: "/admin/monitoring", label: "Monitoring", icon: Activity, roles: ["admin"] },
];

const SIDEBAR_COLLAPSED_KEY = "vaniai_sidebar_collapsed";

function VaniAILogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="gradient-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md">
        <GraduationCap className="h-5 w-5" aria-hidden="true" />
      </div>
      {!collapsed && (
        <span className="gradient-text whitespace-nowrap text-xl font-extrabold tracking-tight">
          VaniAI
        </span>
      )}
    </div>
  );
}

/**
 * Authenticated app shell: collapsible role-filtered sidebar, topbar with
 * theme toggle and user menu, and animated page transitions around the
 * routed content.
 */
export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navItems = useMemo(
    () =>
      user ? NAV_ITEMS.filter((item) => item.roles.includes(user.role)) : [],
    [user],
  );

  const pageTitle = useMemo(() => {
    let best: NavItem | undefined;
    for (const item of navItems) {
      const matches = item.end
        ? location.pathname === item.to
        : location.pathname === item.to ||
          location.pathname.startsWith(`${item.to}/`);
      if (matches && (!best || item.to.length > best.to.length)) {
        best = item;
      }
    }
    return best?.label ?? "VaniAI";
  }, [navItems, location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!previous));
      return !previous;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-200",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64",
          "w-64 -translate-x-full lg:translate-x-0",
          mobileOpen && "translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b px-4",
            collapsed ? "lg:justify-center lg:px-2" : "justify-between",
          )}
        >
          <VaniAILogo collapsed={collapsed} />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn("hidden lg:inline-flex", collapsed && "lg:hidden")}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    collapsed && "lg:justify-center lg:px-2",
                    isActive
                      ? "gradient-primary text-white shadow-md"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {collapsed && (
          <div className="hidden border-t p-3 lg:block">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className="w-full"
              aria-label="Expand sidebar"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-all duration-200",
          collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64",
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
            {pageTitle}
          </h2>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 px-2"
                aria-label="Open user menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="gradient-primary text-xs text-white">
                    {getInitials(user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                  {user?.full_name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-medium">{user?.full_name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </p>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {user ? ROLE_LABELS[user.role] : ""}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void handleLogout()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Routed content with page transitions */}
        <main className="flex-1 p-4 sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto w-full max-w-7xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
