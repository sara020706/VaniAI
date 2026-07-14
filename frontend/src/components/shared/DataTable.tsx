import { Inbox } from "lucide-react";
import * as React from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  /** Field key (used for cell lookup when no custom renderer is given). */
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  /** Stable row key; falls back to the row index. */
  rowKey?: (row: T, index: number) => string | number;
  emptyMessage?: string;
  className?: string;
}

function defaultCell<T>(row: T, key: string): React.ReactNode {
  const value = (row as Record<string, unknown>)[key];
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}

/**
 * Generic typed table. Custom cells via `render`; rows become clickable
 * (with keyboard support) when `onRowClick` is provided.
 */
export function DataTable<T>({
  columns,
  data,
  onRowClick,
  rowKey,
  emptyMessage = "No records found",
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={emptyMessage}
        description="Nothing to show here yet."
        className={className}
      />
    );
  }

  return (
    <div className={cn("rounded-xl border", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={rowKey ? rowKey(row, index) : index}
              className={cn(onRowClick && "cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.render ? column.render(row) : defaultCell(row, column.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
