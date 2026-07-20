import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  DataTable,
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
  type DataTableColumn,
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
import { Switch } from "@/components/ui/switch";
import { adminApi } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate, getApiErrorMessage } from "@/lib/utils";
import type {
  Role,
  User,
  UserCreatePayload,
  UserListParams,
  UserUpdatePayload,
} from "@/types";

import { adminKeys, useUsers } from "@/pages/admin/use-admin";

const ALL_VALUE = "__all__";
const PAGE_SIZE = 20;

const ROLES: Role[] = ["student", "faculty", "placement_officer", "admin"];

const ROLE_BADGE_VARIANT: Record<
  Role,
  "default" | "secondary" | "success" | "warning"
> = {
  admin: "default",
  placement_officer: "warning",
  faculty: "success",
  student: "secondary",
};

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
// Form schemas
// ---------------------------------------------------------------------------

const roleEnum = z.enum(["student", "faculty", "placement_officer", "admin"]);

const createSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: roleEnum,
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  role: roleEnum,
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= 8, {
      message: "Password must be at least 8 characters",
    }),
});
type EditForm = z.infer<typeof editSchema>;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={ROLE_BADGE_VARIANT[role]}>
      {role === "admin" && <ShieldCheck aria-hidden="true" />}
      {ROLE_LABELS[role]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

function CreateUserDialog({
  open,
  onOpenChange,
  invalidateKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invalidateKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: "student",
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: UserCreatePayload) => adminApi.createUser(payload),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      void queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success(`Created ${user.email}.`);
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not create the user."));
    },
  });

  const role = watch("role");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />
            Create user
          </DialogTitle>
          <DialogDescription>
            Add a new account. The user can sign in immediately with these
            credentials.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="create-full-name">Full name</Label>
            <Input
              id="create-full-name"
              autoComplete="name"
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              autoComplete="off"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setValue("role", value as Role, { shouldValidate: true })
              }
            >
              <SelectTrigger aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit dialog
// ---------------------------------------------------------------------------

function EditUserDialog({
  user,
  onClose,
  invalidateKey,
}: {
  user: User | null;
  onClose: () => void;
  invalidateKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { full_name: "", role: "student", password: "" },
  });

  useEffect(() => {
    if (user) {
      reset({ full_name: user.full_name, role: user.role, password: "" });
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (payload: UserUpdatePayload) =>
      adminApi.updateUser(user!.id, payload),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      void queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success(`Updated ${updated.email}.`);
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not update the user."));
    },
  });

  const role = watch("role");

  return (
    <Dialog open={Boolean(user)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
            Edit user
          </DialogTitle>
          <DialogDescription>
            {user?.email} · leave the password blank to keep it unchanged.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => {
            const payload: UserUpdatePayload = {
              full_name: values.full_name,
              role: values.role,
            };
            if (values.password && values.password.length > 0) {
              payload.password = values.password;
            }
            mutation.mutate(payload);
          })}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="edit-full-name">Full name</Label>
            <Input
              id="edit-full-name"
              autoComplete="name"
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setValue("role", value as Role, { shouldValidate: true })
              }
            >
              <SelectTrigger aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-password">New password</Label>
            <Input
              id="edit-password"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Activate / deactivate confirm dialog
// ---------------------------------------------------------------------------

function ToggleActiveDialog({
  user,
  onClose,
  invalidateKey,
}: {
  user: User | null;
  onClose: () => void;
  invalidateKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  const willActivate = user ? !user.is_active : false;

  const mutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user selected");
      if (user.is_active) {
        // Soft-delete = deactivate.
        return adminApi.deleteUser(user.id).then(() => undefined);
      }
      return adminApi.updateUser(user.id, { is_active: true }).then(() => undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      void queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success(
        willActivate ? "User activated." : "User deactivated.",
      );
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not update the user."));
    },
  });

  return (
    <Dialog open={Boolean(user)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle
            className={
              willActivate ? "text-success" : "text-destructive"
            }
          >
            {willActivate ? "Activate user" : "Deactivate user"}
          </DialogTitle>
          <DialogDescription>
            {willActivate
              ? `Restore access for ${user?.email}? They will be able to sign in again.`
              : `Deactivate ${user?.email}? They will be signed out and blocked from signing in until reactivated.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={willActivate ? "gradient" : "destructive"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            {willActivate ? "Activate" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const [page, setPage] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL_VALUE);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [toggleUser, setToggleUser] = useState<User | null>(null);

  const search = useDebouncedValue(searchInput, 350);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const params: UserListParams = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      search: search.trim() ? search.trim() : undefined,
      role: roleFilter === ALL_VALUE ? undefined : (roleFilter as Role),
    }),
    [page, search, roleFilter],
  );

  const query = useUsers(params);
  const invalidateKey = adminKeys.users(params);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const columns: DataTableColumn<User>[] = [
    {
      key: "full_name",
      header: "User",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => <RoleBadge role={row.role} />,
    },
    {
      key: "created_at",
      header: "Joined",
      render: (row) => formatDate(row.created_at),
      className: "tabular-nums",
    },
    {
      key: "is_active",
      header: "Active",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.is_active}
            onCheckedChange={() => setToggleUser(row)}
            aria-label={
              row.is_active
                ? `Deactivate ${row.full_name}`
                : `Activate ${row.full_name}`
            }
          />
          <span className="text-xs text-muted-foreground">
            {row.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16 text-right",
      render: (row) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${row.full_name}`}
          onClick={() => setEditUser(row)}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage accounts, roles and access across VaniAI."
        actions={
          <Button variant="gradient" onClick={() => setCreateOpen(true)}>
            <UserPlus aria-hidden="true" />
            Create user
          </Button>
        }
      />

      <GlassCard className="p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Filter directory
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-2">
            <Label
              htmlFor="user-search"
              className="mb-1.5 block text-xs text-muted-foreground"
            >
              Search
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="user-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or email…"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Role
            </Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All roles</SelectItem>
                {ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {query.isLoading ? (
        <LoadingState label="Loading users…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          <motion.div variants={itemVariants}>
            <DataTable
              columns={columns}
              data={query.data.items}
              rowKey={(row) => row.id}
              emptyMessage="No users match these filters"
            />
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center justify-between gap-3 sm:flex-row"
          >
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? "No results"
                : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || query.isFetching}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages || query.isFetching}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        invalidateKey={invalidateKey}
      />
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        invalidateKey={invalidateKey}
      />
      <ToggleActiveDialog
        user={toggleUser}
        onClose={() => setToggleUser(null)}
        invalidateKey={invalidateKey}
      />
    </div>
  );
}
