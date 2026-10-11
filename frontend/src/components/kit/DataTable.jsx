import { useId, useState } from 'react';
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EmptyState from '@/components/kit/EmptyState';
import { TableSkeleton } from '@/components/kit/Loaders';
import { cn } from '@/lib/utils';

// Admin and vendor tables. Columns are TanStack column defs; each may add
//   meta: { mobile: 'title' | 'subtitle' | 'field' | 'actions' | 'hidden', label }
// From md up it is a table with a sticky header; below md every row becomes a
// card built from the same columns, so the actions are never scrolled off-screen.
export default function DataTable({
  columns, data, getRowId, searchLabel = 'Search', searchPlaceholder = 'Search…',
  toolbar, empty, loading = false, pageSize = 10, className,
}) {
  const searchId = useId();
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const role = (column) => column.columnDef.meta?.mobile || 'field';

  return (
    <div className={cn('grid gap-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="bg-surface-raised sm:max-w-xs">
          <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
          <label htmlFor={searchId} className="sr-only">{searchLabel}</label>
          <InputGroupInput
            id={searchId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(event) => { setGlobalFilter(event.target.value); table.setPageIndex(0); }}
          />
        </InputGroup>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>

      {loading ? <TableSkeleton columns={Math.min(columns.length, 5)} /> : !filteredCount ? (
        empty || <EmptyState title={globalFilter ? 'No matches' : 'Nothing here yet'} description={globalFilter ? `Nothing matches “${globalFilter}”. Try a different search.` : undefined} />
      ) : (
        <>
          {/* md and up: table */}
          <div className="hidden max-h-[70vh] overflow-auto rounded-xl border bg-card shadow-hairline md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface-sunken">
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id} className="hover:bg-transparent">
                    {group.headers.map((header) => {
                      const sortable = header.column.getCanSort() && header.column.columnDef.enableSorting !== false && header.column.accessorFn;
                      const sorted = header.column.getIsSorted();
                      return (
                        <TableHead
                          key={header.id}
                          aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
                          className="h-11 text-xs font-semibold text-text-muted"
                        >
                          {header.isPlaceholder ? null : sortable ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === 'asc' ? <ArrowUp aria-hidden="true" className="size-3.5" />
                                : sorted === 'desc' ? <ArrowDown aria-hidden="true" className="size-3.5" />
                                  : <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />}
                            </button>
                          ) : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* below md: one card per row */}
          <ul className="grid gap-2 md:hidden">
            {rows.map((row) => {
              const cells = row.getVisibleCells();
              const pick = (kind) => cells.filter((cell) => role(cell.column) === kind);
              return (
                <li key={row.id} className="grid gap-3 rounded-xl border bg-card p-4 shadow-hairline">
                  <div className="min-w-0">
                    {pick('title').map((cell) => <div key={cell.id} className="min-w-0 font-medium break-words text-foreground">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>)}
                    {pick('subtitle').map((cell) => <div key={cell.id} className="min-w-0 text-sm break-words text-text-muted">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>)}
                  </div>
                  {pick('field').length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                      {pick('field').map((cell) => (
                        <div key={cell.id} className="contents">
                          <dt className="text-text-muted">{cell.column.columnDef.meta?.label || cell.column.columnDef.header}</dt>
                          <dd className="min-w-0 text-right break-words text-foreground">{flexRender(cell.column.columnDef.cell, cell.getContext())}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {pick('actions').map((cell) => <div key={cell.id} className="flex flex-wrap gap-2 border-t pt-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>)}
                </li>
              );
            })}
          </ul>

          {pageCount > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm text-text-muted">
              <span>Page {pageIndex + 1} of {pageCount} · {filteredCount} results</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft data-icon="inline-start" />Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  Next<ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
