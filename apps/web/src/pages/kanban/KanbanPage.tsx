import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { useDebounce } from '../../hooks/useDebounce'
import type { Document } from '@gi/shared-types'
import { FileText, Clock, CheckCircle, XCircle, Archive, AlertTriangle } from 'lucide-react'

interface Column {
  statut: string
  label: string
  color: string
  bg: string
  icon: React.ElementType
}

const COLUMNS: Column[] = [
  { statut: 'BROUILLON',   label: 'Brouillons',  color: 'text-muted-foreground', bg: 'bg-muted',        icon: FileText      },
  { statut: 'SOUMIS',      label: 'En révision',  color: 'text-blue-600',         bg: 'bg-blue-500/10',  icon: Clock         },
  { statut: 'REJETE',      label: 'Rejetés',      color: 'text-destructive',      bg: 'bg-destructive/10', icon: XCircle     },
  { statut: 'VALIDE',      label: 'Validés',      color: 'text-green-600',        bg: 'bg-green-500/10', icon: CheckCircle   },
  { statut: 'ARCHIVE',     label: 'Archivés',     color: 'text-amber-600',        bg: 'bg-amber-500/10', icon: Archive       },
  { statut: 'A_DETRUIRE',  label: 'À détruire',   color: 'text-orange-600',       bg: 'bg-orange-500/10', icon: AlertTriangle },
]

async function fetchAllDocs(): Promise<Document[]> {
  const { data } = await api.get<{ data: Document[] }>('/documents?limit=200&sortBy=updatedAt&sortOrder=desc')
  return data.data
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days}j`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months} mois`
  return `il y a ${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? 's' : ''}`
}

export function KanbanPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['kanban-docs'],
    queryFn: fetchAllDocs,
    staleTime: 30_000,
  })

  const filtered = debouncedSearch
    ? docs.filter((d) => d.titre.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : docs

  const byStatut = new Map<string, Document[]>()
  for (const col of COLUMNS) byStatut.set(col.statut, [])
  for (const doc of filtered) {
    const list = byStatut.get(doc.statut)
    if (list) list.push(doc)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Tableau Kanban</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Workflow des documents par statut</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer les documents…"
          className="px-4 py-2 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all w-64"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
          Chargement…
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {COLUMNS.map((col) => {
            const items = byStatut.get(col.statut) ?? []
            const Icon = col.icon
            return (
              <div key={col.statut} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl mb-3 ${col.bg}`}>
                  <Icon className={`w-4 h-4 ${col.color}`} />
                  <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-card ${col.color}`}>
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-2xl py-8 text-center">
                      <p className="text-xs text-muted-foreground">Aucun document</p>
                    </div>
                  )}
                  {items.map((doc, i) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link to={`/documents/${doc.id}`}>
                        <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group card-hover">
                          <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                            {doc.titre}
                          </p>

                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {doc.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">
                                  {tag}
                                </span>
                              ))}
                              {doc.tags.length > 3 && (
                                <span className="text-xs text-muted-foreground">+{doc.tags.length - 3}</span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                              {doc.auteurId?.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-muted-foreground">{timeAgo(doc.updatedAt)}</span>
                          </div>

                          {doc.dateExpiration && new Date(doc.dateExpiration) <= new Date() && (
                            <div className="mt-2 px-2 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Expiré
                            </div>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
