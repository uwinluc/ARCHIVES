import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, SlidersHorizontal, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { DocumentTable } from '../../components/documents/DocumentTable'
import { UploadDialog } from '../../components/documents/UploadDialog'
import { useAuth } from '../../contexts/AuthContext'
import type { StatutDocument } from '@gi/shared-types'

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

const STATUT_OPTIONS: { value: StatutDocument; label: string; color: string }[] = [
  { value: 'BROUILLON',  label: 'Brouillon',   color: 'bg-slate-100 text-slate-600 border-slate-200 data-[active=true]:bg-slate-600 data-[active=true]:text-white data-[active=true]:border-slate-600' },
  { value: 'SOUMIS',     label: 'Soumis',       color: 'bg-blue-50 text-blue-600 border-blue-200 data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:border-blue-600' },
  { value: 'VALIDE',     label: 'Validé',       color: 'bg-emerald-50 text-emerald-600 border-emerald-200 data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:border-emerald-600' },
  { value: 'ARCHIVE',    label: 'Archivé',      color: 'bg-purple-50 text-purple-600 border-purple-200 data-[active=true]:bg-purple-600 data-[active=true]:text-white data-[active=true]:border-purple-600' },
  { value: 'A_DETRUIRE', label: 'À détruire',   color: 'bg-red-50 text-red-600 border-red-200 data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:border-red-600' },
]

export function DocumentsPage() {
  const { profile } = useAuth()
  const rank = profile ? ROLE_RANK[profile.role] ?? 0 : 0
  const canUpload = rank >= ROLE_RANK['COLLABORATEUR']

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState<StatutDocument[]>([])
  const [showUpload, setShowUpload] = useState(false)

  const { data, isFetching } = useDocuments({
    page, limit: 20,
    q: search || undefined,
    statut: statut.length ? statut : undefined,
    sortBy: 'createdAt', sortOrder: 'desc',
  })

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  const toggleStatut = (s: StatutDocument) =>
    setStatut((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {data && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{data.total}</span>
              {' '}document{data.total !== 1 ? 's' : ''}
              {statut.length > 0 && <span className="ml-1 text-muted-foreground">· filtrés</span>}
            </p>
          )}
        </div>
        {canUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md active:scale-95"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
          >
            <Plus className="w-4 h-4" />
            Nouveau document
          </button>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border px-4 py-3.5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher un document…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Status chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {STATUT_OPTIONS.map((s) => {
            const isActive = statut.includes(s.value)
            return (
              <button
                key={s.value}
                data-active={isActive}
                onClick={() => { toggleStatut(s.value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${s.color}`}
              >
                {s.label}
              </button>
            )
          })}
          {statut.length > 0 && (
            <button
              onClick={() => setStatut([])}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <X className="w-3 h-3" />
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <DocumentTable documents={data?.data ?? []} loading={isFetching && !data} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
            <p className="text-xs text-muted-foreground tabular-nums">
              Page <span className="font-semibold text-foreground">{page}</span> sur {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
              >
                ← Précédent
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}
    </motion.div>
  )
}
