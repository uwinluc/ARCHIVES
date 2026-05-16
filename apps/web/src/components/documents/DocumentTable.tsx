import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel, flexRender,
  createColumnHelper, type SortingState, type RowSelectionState,
} from '@tanstack/react-table'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileX, AlertCircle, Eye, CheckCircle, XCircle, Archive,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Document } from '@gi/shared-types'
import { StatutBadge } from './StatutBadge'
import { useDocumentMutation } from '../../hooks/useDocuments'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const colHelper = createColumnHelper<Document>()

interface Props { documents: Document[]; loading?: boolean }

export function DocumentTable({ documents, loading }: Props) {
  const { profile } = useAuth()
  const rank = profile ? ROLE_RANK[profile.role] ?? 0 : 0
  const { soumettre, valider, rejeter, archiver } = useDocumentMutation()
  const [rejetId, setRejetId] = useState<string | null>(null)
  const [motif, setMotif] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const canValidate = rank >= ROLE_RANK['MANAGER']
  const canArchive  = rank >= ROLE_RANK['ARCHIVISTE']

  const columns = useMemo(() => [
    colHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input type="checkbox"
          checked={table.getIsAllRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected() }}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="rounded border-border accent-blue-600 cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-border accent-blue-600 cursor-pointer"
        />
      ),
      size: 40,
    }),

    colHelper.accessor('titre', {
      header: 'Titre',
      cell: (info) => {
        const doc = info.row.original
        return (
          <div className="min-w-0">
            <Link to={`/documents/${doc.id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 text-sm">
              {info.getValue()}
            </Link>
            {doc.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {doc.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                    {t}
                  </span>
                ))}
                {doc.tags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        )
      },
    }),

    colHelper.accessor('statut', {
      header: 'Statut',
      cell: (info) => <StatutBadge statut={info.getValue()} />,
    }),

    colHelper.accessor('confidentialite', {
      header: 'Conf.',
      cell: (info) => {
        const v = info.getValue()
        if (!v || v === 'PUBLIC') return <span className="text-xs text-muted-foreground">Public</span>
        const style = v === 'SECRET'
          ? 'text-red-600 bg-red-50 border-red-100'
          : 'text-amber-600 bg-amber-50 border-amber-100'
        return (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style}`}>{v}</span>
        )
      },
    }),

    colHelper.accessor('dateDocument', {
      header: 'Date',
      cell: (info) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
          {new Date(info.getValue()).toLocaleDateString('fr-FR')}
        </span>
      ),
    }),

    colHelper.display({
      id: 'taille',
      header: 'Taille',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
          {row.original.currentVersion ? formatSize(row.original.currentVersion.taille) : '—'}
        </span>
      ),
    }),

    colHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const doc = row.original
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="ghost" size="sm" asChild className="h-7 w-7 sm:w-auto px-0 sm:px-2.5 text-xs gap-1">
              <Link to={`/documents/${doc.id}`}>
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Voir</span>
              </Link>
            </Button>
            <div className="hidden sm:flex items-center gap-1.5">
              {doc.statut === 'BROUILLON' && profile?.id === doc.auteurId && (
                <Button size="sm" variant="outline" disabled={soumettre.isPending}
                  onClick={() => soumettre.mutate(doc.id)}
                  className="h-7 px-2.5 text-xs">
                  Soumettre
                </Button>
              )}
              {doc.statut === 'SOUMIS' && canValidate && (
                <Button size="sm" disabled={valider.isPending}
                  onClick={() => valider.mutate(doc.id)}
                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Valider
                </Button>
              )}
              {doc.statut === 'SOUMIS' && canValidate && (
                <Button size="sm" variant="destructive"
                  onClick={() => setRejetId(doc.id)}
                  className="h-7 px-2.5 text-xs gap-1">
                  <XCircle className="w-3 h-3" />
                  Rejeter
                </Button>
              )}
              {doc.statut === 'VALIDE' && canArchive && (
                <Button size="sm" variant="outline" disabled={archiver.isPending}
                  onClick={() => archiver.mutate(doc.id)}
                  className="h-7 px-2.5 text-xs gap-1">
                  <Archive className="w-3 h-3" />
                  Archiver
                </Button>
              )}
            </div>
          </div>
        )
      },
    }),
  ], [profile, canValidate, canArchive, soumettre, valider, archiver])

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const selectedCount = Object.keys(rowSelection).length

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-10 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <FileX className="w-6 h-6 opacity-40" />
        </div>
        <p className="text-sm font-medium">Aucun document trouvé</p>
        <p className="text-xs text-muted-foreground">Modifiez vos filtres ou déposez un nouveau document</p>
      </div>
    )
  }

  return (
    <>
      {/* Selection bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 py-2.5 border-b border-primary/20 flex items-center gap-3"
            style={{ background: 'rgba(37,99,235,0.05)' }}
          >
            <span className="text-sm font-semibold text-primary">
              {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
            </span>
            <button onClick={() => setRowSelection({})}
              className="text-xs text-primary/60 hover:text-primary transition-colors">
              Tout désélectionner
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => (
                  <th key={header.id}
                    className={cn(
                      'py-3 px-4 first:pl-5 last:pr-5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground transition-colors',
                      header.id === 'confidentialite' && 'hidden sm:table-cell',
                      header.id === 'dateDocument' && 'hidden sm:table-cell',
                      header.id === 'taille' && 'hidden md:table-cell',
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3 h-3 text-primary" />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3 text-primary" />}
                      {header.column.getCanSort() && !header.column.getIsSorted() && (
                        <ChevronsUpDown className="w-3 h-3 opacity-25" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}
                className={cn(
                  'hover:bg-muted/50 transition-colors group',
                  row.getIsSelected() && 'bg-primary/5',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn(
                    'py-3.5 px-4 first:pl-5 last:pr-5',
                    cell.column.id === 'confidentialite' && 'hidden sm:table-cell',
                    cell.column.id === 'dateDocument' && 'hidden sm:table-cell',
                    cell.column.id === 'taille' && 'hidden md:table-cell',
                  )}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-3.5 border-t border-border flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground tabular-nums">
          Page <span className="font-semibold text-foreground">{table.getState().pagination.pageIndex + 1}</span>
          {' / '}{table.getPageCount()}
          <span className="mx-1.5 text-border">·</span>
          <span className="font-semibold text-foreground">{table.getFilteredRowModel().rows.length}</span> résultat{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          {[
            { Icon: ChevronsLeft,  action: () => table.setPageIndex(0),                        disabled: !table.getCanPreviousPage() },
            { Icon: ChevronLeft,   action: () => table.previousPage(),                          disabled: !table.getCanPreviousPage() },
            { Icon: ChevronRight,  action: () => table.nextPage(),                              disabled: !table.getCanNextPage() },
            { Icon: ChevronsRight, action: () => table.setPageIndex(table.getPageCount() - 1), disabled: !table.getCanNextPage() },
          ].map(({ Icon, action, disabled }, i) => (
            <Button key={i} variant="outline" size="icon"
              className="h-7 w-7 rounded-lg" onClick={action} disabled={disabled}>
              <Icon className="w-3.5 h-3.5" />
            </Button>
          ))}
        </div>
      </div>

      {/* Rejet dialog */}
      <Dialog open={!!rejetId} onOpenChange={(open) => { if (!open) { setRejetId(null); setMotif('') } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-4 h-4 text-destructive" />
              Motif de rejet
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none transition-all"
            placeholder="Expliquer la raison du rejet…"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejetId(null); setMotif('') }}>
              Annuler
            </Button>
            <Button variant="destructive"
              disabled={!motif.trim() || rejeter.isPending}
              onClick={() => rejetId && rejeter.mutate(
                { id: rejetId, motif },
                { onSuccess: () => { setRejetId(null); setMotif('') } },
              )}>
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
