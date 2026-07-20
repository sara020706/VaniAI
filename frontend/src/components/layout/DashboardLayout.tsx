import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  Boxes,
  Building2,
  ChevronLeft,
  ClipboardList,
  Command,
  Database,
  FileText,
  GitCompareArrows,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
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
      <div className="gradient-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-md">
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

  // Uppercase eyebrow shown above the current role's nav group.
  const navGroupLabel = user ? ROLE_LABELS[user.role] : "";

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
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/70 bg-card transition-all duration-200",
          collapsed ? "lg:w-[4.75rem]" : "lg:w-64",
          "w-64 -translate-x-full lg:translate-x-0",
          mobileOpen && "translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/70 px-4",
            collapsed ? "lg:justify-center lg:px-2" : "justify-between",
          )}
        >
          <VaniAILogo collapsed={collapsed} />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn(
              "hidden rounded-xl text-muted-foreground lg:inline-flex",
              collapsed && "lg:hidden",
            )}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Workspace / role chip */}
        <div className={cn("px-3 pt-3", collapsed && "lg:px-2")}>
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2.5",
              collapsed && "lg:justify-center lg:px-0 lg:py-2",
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
            </span>
            {!collapsed && (
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-foreground">
                  Workspace
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {navGroupLabel}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Command-style search affordance (visual; opens nothing) */}
        <div className={cn("px-3 pt-3", collapsed && "lg:px-2")}>
          <button
            type="button"
            aria-label="Search"
            className={cn(
              "group flex w-full items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Search…</span>
                <kbd className="pointer-events-none inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-background px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
                  <Command className="h-2.5 w-2.5" aria-hidden="true" />K
                </kbd>
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {!collapsed && (
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {navGroupLabel}
            </p>
          )}
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
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                    collapsed && "lg:justify-center lg:px-2",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-bar"
                        className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary"
                        aria-hidden="true"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                        isActive && "text-primary",
                      )}
                      aria-hidden="true"
                    />
                    <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {collapsed && (
          <div className="hidden border-t border-border/70 p-3 lg:block">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className="w-full rounded-xl text-muted-foreground"
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
          collapsed ? "lg:pl-[4.75rem]" : "lg:pl-64",
        )}
      >
        {/* Topbar */}
        <header className="glass-card sticky top-0 z-20 flex h-16 items-center gap-2 rounded-none border-x-0 border-t-0 border-b border-border/60 px-4 sm:gap-3 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {pageTitle}
          </h2>

          {/* Command-style search trigger (visual; keyboard-focusable) */}
          <button
            type="button"
            aria-label="Search"
            className="group hidden h-9 items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 sm:inline-flex"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Search…</span>
            <kbd className="pointer-events-none ml-1 inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-background px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
              <Command className="h-2.5 w-2.5" aria-hidden="true" />K
            </kbd>
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-xl"
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

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-xl"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span
                  className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-electric ring-2 ring-background"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 rounded-2xl">
              <DropdownMenuLabel className="text-sm font-semibold">
                Notifications
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid-backdrop flex flex-col items-center gap-1.5 rounded-xl px-4 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  You&apos;re all caught up
                </p>
                <p className="text-xs text-muted-foreground">
                  New alerts will show up here.
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 rounded-xl px-2"
                aria-label="Open user menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="gradient-primary text-xs text-white">
                    {getInitials(user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden flex-col items-start leading-tight sm:flex">
                  <span className="max-w-[10rem] truncate text-sm font-medium">
                    {user?.full_name}
                  </span>
                  <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
                    {user ? ROLE_LABELS[user.role] : ""}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="gradient-primary text-xs text-white">
                    {getInitials(user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {user?.full_name}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                  <span className="mt-0.5 text-xs font-normal text-primary">
                    {user ? ROLE_LABELS[user.role] : ""}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void handleLogout()}
                className="rounded-lg text-destructive focus:text-destructive"
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
              transition={{ duration: 0.25, ease: "easeOut" }}
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
