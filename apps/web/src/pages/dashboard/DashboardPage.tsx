import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Legend,
} from 'recharts'
import {
  Files, Clock, AlertTriangle, Trash2, TrendingUp, Activity,
  ArrowUpRight, Building2,
} from 'lucide-react'
import { useStats } from '../../hooks/useStats'
import { useAuth } from '../../contexts/AuthContext'
import { Skeleton } from '../../components/ui/skeleton'
import type { StatutDocument, ActionAudit, StatsFiliale } from '@gi/shared-types'

const STATUT_LABEL: Record<StatutDocument, string> = {
  BROUILLON: 'Brouillon', SOUMIS: 'Soumis', REJETE: 'Rejeté',
  VALIDE: 'Validé', ARCHIVE: 'Archivé', A_DETRUIRE: 'À détruire', DETRUIT: 'Détruit',
}

const STATUT_COLOR: Record<string, string> = {
  BROUILLON: '#94a3b8', SOUMIS: '#3b82f6', REJETE: '#ef4444',
  VALIDE: '#22c55e', ARCHIVE: '#8b5cf6', A_DETRUIRE: '#f97316', DETRUIT: '#475569',
}

const ACTION_LABEL: Partial<Record<ActionAudit, string>> = {
  UPLOAD: 'Dépôt', SOUMISSION: 'Soumission', VALIDATION: 'Validation',
  REJET: 'Rejet', ARCHIVAGE: 'Archivage', PROPOSITION_DESTRUCTION: 'Prop. destruction',
  DESTRUCTION: 'Destruction', TELECHARGEMENT: 'Téléchargement',
  PARTAGE_CREATION: 'Partage créé', PARTAGE_VALIDATION: 'Partage validé',
  PARTAGE_REVOCATION: 'Partage révoqué', NOUVELLE_VERSION: 'Nouvelle version',
}

const ACTION_COLOR: Partial<Record<ActionAudit, string>> = {
  UPLOAD: 'bg-blue-500', VALIDATION: 'bg-emerald-500', REJET: 'bg-red-500',
  ARCHIVAGE: 'bg-purple-500', DESTRUCTION: 'bg-red-700',
  SOUMISSION: 'bg-amber-500', TELECHARGEMENT: 'bg-slate-400',
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  return new Date(iso).toLocaleDateString('fr-FR')
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  color: 'hsl(var(--foreground))',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}
const GRID_COLOR = 'hsl(var(--border))'
const TICK_COLOR = 'hsl(var(--muted-foreground))'

const fade = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } }

/* ── KPI Card ─────────────────────────────────────────────────── */
interface KpiProps {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  gradient: string
  trend?: number
}

function KpiCard({ label, value, sub, icon, gradient, trend }: KpiProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 relative overflow-hidden card-hover">
      {/* Background gradient blob */}
      <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 blur-xl ${gradient}`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${gradient} bg-opacity-10`}>
            {icon}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              <ArrowUpRight className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-muted-foreground mt-1 uppercase tracking-wide">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Filiale Row ───────────────────────────────────────────────── */
function FilialeRow({ row }: { row: StatsFiliale }) {
  return (
    <tr className="border-t border-border hover:bg-muted/50 transition-colors">
      <td className="py-3 px-4">
        <span className="font-mono text-[11px] font-bold bg-muted px-2 py-1 rounded-md text-foreground tracking-wider">
          {row.filiale.code}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-foreground font-medium hidden sm:table-cell">{row.filiale.nom}</td>
      <td className="py-3 px-4 text-sm font-bold text-foreground text-right tabular-nums">{row.totalDocuments}</td>
      <td className="py-3 px-4 text-right hidden md:table-cell">
        <span className="text-sm font-medium text-blue-500 tabular-nums">{row.parStatut.SOUMIS ?? 0}</span>
      </td>
      <td className="py-3 px-4 text-right hidden md:table-cell">
        <span className="text-sm font-medium text-emerald-500 tabular-nums">{row.parStatut.VALIDE ?? 0}</span>
      </td>
      <td className="py-3 px-4 text-right hidden lg:table-cell">
        <span className="text-sm text-muted-foreground tabular-nums">{row.parStatut.ARCHIVE ?? 0}</span>
      </td>
      <td className="py-3 px-4 text-right">
        {row.aDetruire > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
            {row.aDetruire} à détruire
          </span>
        )}
        {row.expirantIn90j > 0 && row.aDetruire === 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100">
            {row.expirantIn90j} expirant
          </span>
        )}
      </td>
    </tr>
  )
}

/* ── Page ──────────────────────────────────────────────────────── */
export function DashboardPage() {
  const { profile } = useAuth()
  const { data, isLoading } = useStats()
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const { global, parFiliale, activiteRecente } = data

  const statutChartData = (Object.entries(STATUT_LABEL) as [StatutDocument, string][])
    .filter(([s]) => s !== 'DETRUIT')
    .map(([statut, label]) => ({ name: label, value: global.parStatut[statut] ?? 0, fill: STATUT_COLOR[statut] }))
    .filter((d) => d.value > 0)

  const filialeBarData = parFiliale.map((row) => ({
    name: row.filiale.code,
    Validés:  row.parStatut.VALIDE ?? 0,
    Soumis:   row.parStatut.SOUMIS ?? 0,
    Archivés: row.parStatut.ARCHIVE ?? 0,
  }))

  const kpis: KpiProps[] = [
    {
      label: 'Total documents',
      value: global.totalDocuments,
      icon: <Files className="w-4 h-4 text-blue-600" />,
      gradient: 'bg-blue-500',
    },
    {
      label: 'En attente',
      value: global.parStatut.SOUMIS ?? 0,
      sub: 'à valider',
      icon: <Clock className="w-4 h-4 text-amber-600" />,
      gradient: 'bg-amber-500',
    },
    {
      label: 'Expirant (90j)',
      value: global.expirantIn90j,
      icon: <AlertTriangle className="w-4 h-4 text-orange-600" />,
      gradient: 'bg-orange-500',
    },
    {
      label: 'À détruire',
      value: global.aDetruire,
      sub: 'double validation',
      icon: <Trash2 className="w-4 h-4 text-red-600" />,
      gradient: global.aDetruire > 0 ? 'bg-red-500' : 'bg-slate-400',
    },
  ]

  return (
    <motion.div className="space-y-6" variants={fade} initial="hidden" animate="show">
      {/* KPIs */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SUPER_ADMIN — Bar chart + table */}
        {isSuperAdmin && parFiliale.length > 0 && (
          <motion.div variants={item} className="lg:col-span-2 space-y-5">
            {filialeBarData.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Documents par filiale</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={filialeBarData} margin={{ left: -16, right: 4, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="Validés"  fill="#22c55e" radius={[4,4,0,0]} maxBarSize={32} />
                    <Bar dataKey="Soumis"   fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={32} />
                    <Bar dataKey="Archivés" fill="#8b5cf6" radius={[4,4,0,0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Détail par filiale</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-4 text-left">Code</th>
                      <th className="py-2.5 px-4 text-left hidden sm:table-cell">Filiale</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                      <th className="py-2.5 px-4 text-right text-blue-500 hidden md:table-cell">Soumis</th>
                      <th className="py-2.5 px-4 text-right text-emerald-500 hidden md:table-cell">Validés</th>
                      <th className="py-2.5 px-4 text-right hidden lg:table-cell">Archivés</th>
                      <th className="py-2.5 px-4 text-right">Alertes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parFiliale.map((row) => <FilialeRow key={row.filiale.id} row={row} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Non SUPER_ADMIN — Pie chart */}
        {!isSuperAdmin && (
          <motion.div variants={item} className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border p-5 h-full">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Répartition par statut</span>
              </div>
              {statutChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={statutChartData} dataKey="value" nameKey="name"
                      cx="50%" cy="45%" outerRadius={88} innerRadius={44}
                      label={({ name, value }) => `${name} (${value})`} labelLine={false}
                      fill="#8884d8"
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <Files className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Aucun document</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Activité récente */}
        <motion.div variants={item}>
          <div className="bg-card rounded-2xl border border-border overflow-hidden h-full flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Activité récente</span>
            </div>
            <div className="flex-1 divide-y divide-border overflow-y-auto max-h-[460px] scrollbar-thin">
              {activiteRecente.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <Activity className="w-6 h-6 opacity-20" />
                  <p className="text-xs">Aucune activité</p>
                </div>
              ) : activiteRecente.map((ev) => (
                <div key={ev.id} className="px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${ACTION_COLOR[ev.action] ?? 'bg-slate-300'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {ev.user.prenom} {ev.user.nom}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {formatRelative(ev.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ACTION_LABEL[ev.action] ?? ev.action}
                        {ev.document && ev.documentId && (
                          <>
                            {' · '}
                            <Link to={`/documents/${ev.documentId}`}
                              className="hover:text-foreground transition-colors truncate inline-block max-w-[160px] align-bottom">
                              {ev.document.titre}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
