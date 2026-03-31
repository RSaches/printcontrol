// src/features/jobs/components/JobsTable.tsx
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { StatusBadge } from "../../../components/shared/StatusBadge";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { formatBytes, formatDate, formatPages } from "../../../utils/format";
import { cn } from "../../../utils/cn";
import type { PrintJob } from "../../../types";

const col = createColumnHelper<PrintJob>();

const columns = [
  col.accessor("document_name", {
    header: "Documento",
    cell: (info) => (
      <span className="font-medium max-w-[240px] truncate block" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor("user_name", { header: "Usuário" }),
  col.accessor("printer_name", {
    header: "Impressora",
    cell: (info) => (
      <span className="max-w-[160px] truncate block text-muted-foreground" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  col.accessor("pages", {
    header: "Páginas",
    cell: (info) => (
      <span className="tabular-nums">{formatPages(info.getValue())}</span>
    ),
  }),
  col.accessor("size_bytes", {
    header: "Tamanho",
    cell: (info) => (
      <span className="tabular-nums text-muted-foreground">
        {formatBytes(info.getValue())}
      </span>
    ),
  }),
  col.accessor("created_at", {
    header: "Data",
    cell: (info) => (
      <span className="tabular-nums text-muted-foreground whitespace-nowrap">
        {formatDate(info.getValue())}
      </span>
    ),
  }),
];

function SortableHeader({
  label,
  isSorted,
  onToggle,
}: {
  label: string;
  isSorted: false | "asc" | "desc";
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 text-left font-medium",
        "hover:text-foreground transition-colors",
        isSorted ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
      {isSorted === "asc"  && <ArrowUp    className="w-3.5 h-3.5" />}
      {isSorted === "desc" && <ArrowDown  className="w-3.5 h-3.5" />}
      {!isSorted           && <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
    </button>
  );
}

interface JobsTableProps {
  data: PrintJob[];
  isLoading: boolean;
}

export function JobsTable({ data, isLoading }: JobsTableProps) {
  const [sorting, setSorting] = useState([{ id: "created_at", desc: true }]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="rounded-xl border overflow-hidden">
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
              <div className="h-4 bg-muted rounded w-48" />
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-5 bg-muted rounded-full w-20" />
              <div className="h-4 bg-muted rounded w-12 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 rounded-xl border border-dashed bg-muted/5">
        <FileX className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum job encontrado</p>
        <p className="text-xs text-muted-foreground/60">
          Tente ajustar os filtros ou aguarde novos jobs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tabela */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/40">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 text-left text-xs">
                    {h.column.getCanSort() ? (
                      <SortableHeader
                        label={String(h.column.columnDef.header)}
                        isSorted={h.column.getIsSorted()}
                        onToggle={h.column.getToggleSortingHandler() as () => void}
                      />
                    ) : (
                      <span className="font-medium text-muted-foreground">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/50">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-muted/30 transition-colors duration-100 group"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Linhas por página</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)} className="text-xs">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2 tabular-nums">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
