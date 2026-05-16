import { motion } from 'framer-motion'
import { useStats } from '../../hooks/useStats'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ShieldCheck, AlertTriangle, Clock, FileText, CheckCircle, XCircle } from 'lucide-react'
import type { Document } from '@gi/shared-types'

const STATUT_COLORS: Record<string, string> = {
  BROUILLON:  '#94a3b8',
  SOUMIS:     '#3b82f6',
  REJETE:     '#ef4444',
  VALIDE:     '#22c55e',
  ARCHIVE:    '#f59e0b',
  A_DETRUIRE: '#f97316',
  DETRUIT:    '#6b7280',
}

const STATUT_LABELS: Record<string, string> = {
  BROUILLON:  'Brouillons',
  SOUMIS:     'En révision',
  REJETE:     'Rejetés',
  VALIDE:     'Validés',
  ARCHIVE:    'Archivés',
  A_DETRUIRE: 'À détruire',
  DETRUIT:    'Détruits',
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Conforme' : score >= 60 ? 'À améliorer' : 'Non conforme'
  const circumference = 251.2
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="12"
            style={{ stroke: 'hsl(var(--muted))' }} />
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="12"
            stroke={color}
            strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{score}%</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

function MetricCard({
  icon: Icon, label, value, sub, color = 'text-foreground', bg = 'bg-muted/50',
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string
  color?: string; bg?: string
}) {
  return (
    <div className={`rounded-2xl border border-border ${bg} px-5 py-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export function ConformitePage() {
  const { data: stats, isLoading: statsLoading } = useStats()

  const { data: expiredDocs = [] } = useQuery({
    queryKey: ['conformite-expired'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Document[]; total: number }>(
        '/documents?statut=VALIDE,ARCHIVE&sortBy=dateExpiration&sortOrder=asc&limit=10',
      )
      return data.data.filter((d) => d.dateExpiration && new Date(d.dateExpiration) < new Date())
    },
    staleTime: 60_000,
  })

  if (statsLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  const g = stats.global
  const total = g.totalDocuments
  const valides = g.parStatut['VALIDE'] ?? 0
  const archives = g.parStatut['ARCHIVE'] ?? 0
  const aDetruire = g.aDetruire
  const expiring90 = g.expirantIn90j
  const rejetes = g.parStatut['REJETE'] ?? 0

  const score = Math.max(0, Math.min(100, total === 0 ? 100 : Math.round(
    100
    - (aDetruire / Math.max(total, 1)) * 20
    - (expiredDocs.length / Math.max(total, 1)) * 30
    - (rejetes / Math.max(total, 1)) * 10,
  )))

  const pieData = Object.entries(g.parStatut)
    .filter(([, count]) => count > 0)
    .map(([statut, count]) => ({
      name: STATUT_LABELS[statut] ?? statut,
      value: count,
      color: STATUT_COLORS[statut] ?? '#94a3b8',
    }))

  return (
    <motion.div
      className="max-w-5xl space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Tableau de conformité</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d'ensemble de la conformité documentaire de votre filiale.
        </p>
      </div>

      {/* Score + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-border col-span-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 pt-4">Score global</p>
          <ScoreGauge score={score} />
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MetricCard icon={FileText}      label="Total"      value={total}               sub="documents"              color="text-foreground"  bg="bg-card" />
          <MetricCard icon={CheckCircle}   label="Validés"    value={valides}             sub="prêts à archiver"       color="text-green-600"   bg="bg-green-500/10" />
          <MetricCard icon={ShieldCheck}   label="Archivés"   value={archives}            sub="en conservation"        color="text-amber-600"   bg="bg-amber-500/10" />
          <MetricCard icon={AlertTriangle} label="À détruire" value={aDetruire}           sub="nécessitent validation" color="text-orange-600"  bg="bg-orange-500/10" />
          <MetricCard icon={Clock}         label="Exp. 90j"   value={expiring90}          sub="expirent bientôt"       color="text-blue-600"    bg="bg-blue-500/10" />
          <MetricCard icon={XCircle}       label="Expirés"    value={expiredDocs.length}  sub="dépassé la limite"      color="text-destructive" bg="bg-destructive/10" />
        </div>
      </div>

      {/* Pie chart + expired list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Répartition par statut</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucun document</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} docs`]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                    fontSize: 12,
                  }}
                />
                <Legend iconType="circle" iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Documents expirés
            {expiredDocs.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                {expiredDocs.length}
              </span>
            )}
          </h2>
          {expiredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-500/30 mb-3" />
              <p className="text-sm font-medium text-foreground">Aucun document expiré</p>
              <p className="text-xs text-muted-foreground mt-1">Tous les documents sont à jour.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expiredDocs.map((doc) => {
                const days = Math.abs(Math.ceil((new Date(doc.dateExpiration!).getTime() - Date.now()) / 86400000))
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-destructive/10 text-sm">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.titre}</p>
                      <p className="text-xs text-destructive mt-0.5">Expiré depuis {days} jour{days > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Per-filiale (SUPER_ADMIN) */}
      {stats.parFiliale && stats.parFiliale.length > 0 && (
        <div className="bg-card rounded-2xl border border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Conformité par filiale</h2>
          <div className="space-y-3">
            {(stats.parFiliale as any[]).map((f) => {
              const fTotal = f.totalDocuments
              const fValide = f.parStatut['VALIDE'] ?? 0
              const fArchive = f.parStatut['ARCHIVE'] ?? 0
              const rate = fTotal === 0 ? 100 : Math.round(((fValide + fArchive) / fTotal) * 100)
              const barColor = rate >= 80 ? '#22c55e' : rate >= 60 ? '#f59e0b' : '#ef4444'
              return (
                <div key={f.filiale.id} className="flex items-center gap-4">
                  <div className="w-16 text-xs font-bold text-foreground font-mono">{f.filiale.code}</div>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: barColor }} />
                  </div>
                  <div className="w-12 text-xs text-right font-semibold text-foreground">{rate}%</div>
                  <div className="w-20 text-xs text-muted-foreground text-right">{fTotal} docs</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}
