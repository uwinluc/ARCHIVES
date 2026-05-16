import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import type { Document } from '@gi/shared-types'
import { Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

interface DocWithExpiration extends Document {
  dateExpiration: string
}

async function fetchExpiringDocs(): Promise<DocWithExpiration[]> {
  const { data } = await api.get<{ data: Document[] }>(
    '/documents?limit=500&sortBy=dateExpiration&sortOrder=asc&statut=VALIDE,ARCHIVE',
  )
  return (data.data as DocWithExpiration[]).filter((d) => d.dateExpiration)
}

function getExpirationStatus(dateExpiration: string): 'expired' | 'critical' | 'warning' | 'ok' {
  const days = Math.ceil((new Date(dateExpiration).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'expired'
  if (days <= 30) return 'critical'
  if (days <= 90) return 'warning'
  return 'ok'
}

const STATUS_CONFIG = {
  expired:  { label: 'Expiré',      color: 'text-destructive',  bg: 'bg-destructive/10 border-destructive/20',  icon: AlertTriangle, dot: 'bg-destructive'   },
  critical: { label: '< 30 jours',  color: 'text-orange-600',   bg: 'bg-orange-500/10 border-orange-500/20',    icon: Clock,         dot: 'bg-orange-500'    },
  warning:  { label: '< 90 jours',  color: 'text-amber-600',    bg: 'bg-amber-500/10 border-amber-500/20',      icon: Clock,         dot: 'bg-amber-500'     },
  ok:       { label: 'À terme',     color: 'text-green-600',    bg: 'bg-green-500/10 border-green-500/20',      icon: CheckCircle,   dot: 'bg-green-500'     },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function monthKey(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function daysUntil(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (days < 0) return `Il y a ${Math.abs(days)} jours`
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  return `Dans ${days} jours`
}

type FilterType = 'all' | 'expired' | 'critical' | 'warning'

export function CalendrierPage() {
  const [filter, setFilter] = useState<FilterType>('all')

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['calendrier-docs'],
    queryFn: fetchExpiringDocs,
    staleTime: 60_000,
  })

  const filtered = filter === 'all'
    ? docs
    : docs.filter((d) => getExpirationStatus(d.dateExpiration) === filter)

  const groups = new Map<string, DocWithExpiration[]>()
  for (const doc of filtered) {
    const key = monthKey(doc.dateExpiration)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(doc)
  }

  const count = (f: FilterType) => docs.filter((d) => getExpirationStatus(d.dateExpiration) === f).length

  const summaryCards: { type: FilterType; label: string; sub: string; color: string; icon: React.ElementType }[] = [
    { type: 'expired',  label: 'Expirés',   sub: 'documents en retard',      color: 'text-destructive', icon: AlertTriangle },
    { type: 'critical', label: 'Critiques', sub: 'expirent dans < 30 jours', color: 'text-orange-600',  icon: Clock         },
    { type: 'warning',  label: 'Attention', sub: 'expirent dans < 90 jours', color: 'text-amber-600',   icon: Clock         },
  ]

  return (
    <motion.div
      className="max-w-4xl space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Calendrier de conservation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi des dates d'expiration des documents validés et archivés.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map(({ type, label, sub, color, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setFilter(filter === type ? 'all' : type)}
            className={`bg-card rounded-2xl border text-left p-4 transition-all card-hover ${
              filter === type ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-border/80'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</span>
            </div>
            <p className={`text-3xl font-black ${color}`}>{count(type)}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border py-16 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-foreground font-medium">
            {filter === 'all' ? "Aucun document avec date d'expiration" : 'Aucun document dans cette catégorie'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {month}
              </h2>
              <div className="space-y-2">
                {items.map((doc) => {
                  const status = getExpirationStatus(doc.dateExpiration)
                  const cfg = STATUS_CONFIG[status]
                  const Icon = cfg.icon
                  return (
                    <Link key={doc.id} to={`/documents/${doc.id}`}>
                      <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-primary/30 hover:shadow-sm transition-all">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.titre}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Expire le {formatDate(doc.dateExpiration)}
                          </p>
                        </div>
                        <div className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {daysUntil(doc.dateExpiration)}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
