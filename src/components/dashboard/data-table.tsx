import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type DataColumn<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  className?: string;
};

type DataTableProps<T> = {
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
};

const MotionRow = motion.create(TableRow);

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty = "Keine Einträge" }: DataTableProps<T>) {
  const reduce = useReducedMotion();
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.header} className={cn(column.numeric && "text-right", column.className)}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <MotionRow
            key={rowKey(row)}
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT, delay: Math.min(index, 15) * 0.02 }}
            onClick={onRowClick && (() => onRowClick(row))}
            className={cn(onRowClick && "cursor-pointer")}
          >
            {columns.map((column) => (
              <TableCell key={column.header} className={cn(column.numeric && "text-right tabular-nums", column.className)}>
                {column.cell(row)}
              </TableCell>
            ))}
          </MotionRow>
        ))}
      </TableBody>
    </Table>
  );
}
