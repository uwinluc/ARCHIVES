import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useCategories } from '../../hooks/useCategories'
import { useDebounce } from '../../hooks/useDebounce'
import { DocumentTable } from '../../components/documents/DocumentTable'
import type { StatutDocument, Confidentialite } from '@gi/shared-types'

const STATUT_OPTIONS: { value: StatutDocument; label: string }[] = [
  { value: 'BROUILLON',   label: 'Brouillon'  },
  { value: 'SOUMIS',      label: 'Soumis'     },
  { value: 'VALIDE',      label: 'Validé'     },
  { value: 'ARCHIVE',     label: 'Archivé'    },
  { value: 'A_DETRUIRE',  label: 'À détruire' },
]

const CONFIDENTIALITE_OPTIONS: { value: Confidentialite; label: string }[] = [
  { value: 'PUBLIC',       label: 'Public'       },
  { value: 'INTERNE',      label: 'Interne'      },
  { value: 'CONFIDENTIEL', label: 'Confidentiel' },
  { value: 'SECRET',       label: 'Secret'       },
]

export function RecherchePage() {
  const [query, setQuery] = useState('')
  const [statut, setStatut] = useState<StatutDocument[]>([])
  const [confidentialite, setConfidentialite] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const debouncedQuery = useDebounce(query, 300)
  const { data: categories = [] } = useCategories()

  const { data, isFetching } = useDocuments({
    q: debouncedQuery || undefined,
    statut: statut.length ? statut : undefined,
    confidentialite: confidentialite || undefined,
    categorieId: categorieId || undefined,
    dateDocumentFrom: dateFrom || undefined,
    dateDocumentTo: dateTo || undefined,
    page,
    limit: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  const totalPages = data ? Math.ceil(data.total / 25) : 1
  const hasFilters = statut.length > 0 || confidentialite || categorieId || dateFrom || dateTo
  const activeFilterCount = [statut.length > 0, !!confidentialite, !!categorieId, !!dateFrom, !!dateTo].filter(Boolean).length

  const toggleStatut = (s: StatutDocument) => {
    setStatut((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
    setPage(1)
  }

  const clearAll = () => {
    setQuery('')
    setStatut([])
    setConfidentialite('')
    setCategorieId('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Recherche avancée</h1>
        <p className="text-sm text-muted-foreground mt-1">Recherche plein-texte avec filtres combinés</p>
      </div>

      {/* Search bar */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder="Titres, descriptions, contenu OCR…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              showFilters || hasFilters
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Statut</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUT_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => toggleStatut(s.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      statut.includes(s.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Confidentialité</label>
              <select
                value={confidentialite}
                onChange={(e) => { setConfidentialite(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                <option value="">Tous niveaux</option>
                {CONFIDENTIALITE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Catégorie</label>
              <select
                value={categorieId}
                onChange={(e) => { setCategorieId(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                <option value="">Toutes catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.libelle}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Date du document</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
                <span className="text-muted-foreground text-sm">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <button onClick={clearAll} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                  Effacer les filtres
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {data && (
          <div className="px-5 py-3 border-b border-border text-xs text-muted-foreground">
            {data.total === 0
              ? 'Aucun résultat'
              : `${data.total} document${data.total !== 1 ? 's' : ''} trouvé${data.total !== 1 ? 's' : ''}`}
            {(debouncedQuery || hasFilters) && data.total > 0 && ' correspondant à votre recherche'}
          </div>
        )}

        <DocumentTable documents={data?.data ?? []} loading={isFetching && !data} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page} sur {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                ← Précédent
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
