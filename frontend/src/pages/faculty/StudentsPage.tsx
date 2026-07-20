import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ListFilter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  DataTable,
  ErrorState,
  LoadingState,
  PageHeader,
  RiskBadge,
  type DataTableColumn,
} from "@/components/shared";
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
import { studentApi } from "@/lib/api";
import { BATCHES, DEPARTMENTS, RISK_LEVEL_ORDER, RISK_LEVELS } from "@/lib/constants";
import { formatPercent, formatScore } from "@/lib/utils";
import type { Department, RiskLevel, StudentListItem } from "@/types";

const ALL_VALUE = "__all__";
const PAGE_SIZE = 20;

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

/** Debounce a rapidly-changing value (e.g. a search box). */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Roster view — a paginated, filterable table of all students. Search is
 * debounced; department / batch / risk selects narrow the list; each row
 * links through to the student detail page.
 */
export default function FacultyStudentsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>("");
  const [department, setDepartment] = useState<string>(ALL_VALUE);
  const [batch, setBatch] = useState<string>(ALL_VALUE);
  const [risk, setRisk] = useState<string>(ALL_VALUE);

  const search = useDebouncedValue(searchInput, 350);

  // Any filter or search change resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, department, batch, risk]);

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      search: search.trim() ? search.trim() : undefined,
      department:
        department === ALL_VALUE ? undefined : (department as Department),
      batch: batch === ALL_VALUE ? undefined : batch,
      risk_level: risk === ALL_VALUE ? undefined : (risk as RiskLevel),
    }),
    [page, search, department, batch, risk],
  );

  const query = useQuery({
    queryKey: ["faculty", "students", params],
    queryFn: () => studentApi.list(params),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<StudentListItem>[] = [
    {
      key: "full_name",
      header: "Student",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.register_number}
          </p>
        </div>
      ),
    },
    { key: "department", header: "Dept" },
    { key: "batch", header: "Batch", className: "tabular-nums" },
    {
      key: "cgpa",
      header: "CGPA",
      render: (row) => formatScore(row.cgpa, 2),
      className: "tabular-nums",
    },
    {
      key: "placement_probability",
      header: "Probability",
      render: (row) => formatPercent(row.placement_probability),
      className: "tabular-nums",
    },
    {
      key: "readiness_overall",
      header: "Readiness",
      render: (row) => formatScore(row.readiness_overall, 1),
      className: "tabular-nums",
    },
    {
      key: "risk_level",
      header: "Risk",
      render: (row) => (row.risk_level ? <RiskBadge level={row.risk_level} /> : "—"),
    },
  ];

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Students"
        description="Browse, search and filter the full student roster."
      />

      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <section className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <ListFilter
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Filter roster
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <Label
                  htmlFor="student-search"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Search
                </Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="student-search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Name or register number"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Department
                </Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger aria-label="Filter by department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All departments</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Batch
                </Label>
                <Select value={batch} onValueChange={setBatch}>
                  <SelectTrigger aria-label="Filter by batch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All batches</SelectItem>
                    {BATCHES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Risk level
                </Label>
                <Select value={risk} onValueChange={setRisk}>
                  <SelectTrigger aria-label="Filter by risk level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All risk levels</SelectItem>
                    {RISK_LEVEL_ORDER.map((level) => (
                      <SelectItem key={level} value={level}>
                        {RISK_LEVELS[level].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </motion.div>

        {query.isLoading ? (
          <LoadingState label="Loading students…" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Roster
                </p>
                <h2 className="text-lg font-bold tracking-tight">
                  {total === 1 ? "1 student" : `${total} students`}
                </h2>
              </div>
              {query.isFetching ? (
                <span className="text-xs text-muted-foreground">Updating…</span>
              ) : null}
            </div>

            <DataTable
              columns={columns}
              data={query.data.items}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(`/faculty/students/${row.id}`)}
              emptyMessage="No students match these filters"
            />

            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
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
            </div>
          </motion.div>
        ) : null}
      </motion.div>
    </div>
  );
}
