import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Share2 } from 'lucide-react'
import { usePartagesEmis, usePartagesRecus, usePartageMutations } from '../../hooks/usePartages'
import { useAuth } from '../../contexts/AuthContext'
import type { PartageDetail, StatutPartage } from '@gi/shared-types'

const STATUT_CONFIG: Record<StatutPartage, { label: string; className: string }> = {
  EN_ATTENTE: { label: 'En attente',  className: 'bg-blue-500/10 text-blue-600'       },
  ACCEPTE:    { label: 'Accepté',     className: 'bg-green-500/10 text-green-600'     },
  REFUSE:     { label: 'Refusé',      className: 'bg-destructive/10 text-destructive' },
  EXPIRE:     { label: 'Expiré',      className: 'bg-muted text-muted-foreground'     },
  REVOQUE:    { label: 'Révoqué',     className: 'bg-orange-500/10 text-orange-600'   },
}

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR')
}

export function PartagesPage() {
  const { profile } = useAuth()
  const rank = profile ? ROLE_RANK[profile.role] ?? 0 : 0
  const canManageDest = rank >= ROLE_RANK['ADMIN_FILIALE']

  const [tab, setTab] = useState<'emis' | 'recus'>('recus')

  const { data: emis = [], isFetching: fetchingEmis } = usePartagesEmis()
  const { data: recus = [], isFetching: fetchingRecus } = usePartagesRecus()
  const { valider, refuser, revoquer } = usePartageMutations()

  const pendingRecus = recus.filter((p) => p.statut === 'EN_ATTENTE').length

  return (
    <motion.div
      className="max-w-5xl space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Partages inter-filiales</h1>
        <p className="text-sm text-muted-foreground mt-1">Documents partagés entre filiales du groupe</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-full sm:w-fit">
        {(['recus', 'emis'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'recus' ? 'Reçus' : 'Émis'}
            {t === 'recus' && pendingRecus > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {pendingRecus}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table reçus */}
      {tab === 'recus' && (
        <PartagesTable
          partages={recus}
          loading={fetchingRecus}
          emptyLabel="Aucun partage reçu"
          renderActions={(p) =>
            canManageDest && p.statut === 'EN_ATTENTE' ? (
              <div className="flex gap-1.5 justify-end">
                <ActionBtn color="green" loading={valider.isPending} onClick={() => valider.mutate(p.id)}>Valider</ActionBtn>
                <ActionBtn color="red"   loading={refuser.isPending} onClick={() => refuser.mutate(p.id)}>Refuser</ActionBtn>
              </div>
            ) : null
          }
          colonnes={[
            { label: 'Document',       render: (p) => <DocLink partage={p} /> },
            { label: 'Source',         render: (p) => <FilialeChip code={p.filialeSrc?.code} />, hideOnMobile: true },
            { label: 'Par',            render: (p) => <span className="text-sm text-muted-foreground">{p.autorisateur?.prenom} {p.autorisateur?.nom}</span>, hideOnMobile: true },
            { label: 'Statut',         render: (p) => <StatutBadge statut={p.statut} /> },
            { label: 'Expiration',     render: (p) => <span className="text-xs text-muted-foreground">{p.expiresAt ? formatDate(p.expiresAt) : 'Permanent'}</span>, hideOnTablet: true },
          ]}
        />
      )}

      {/* Table émis */}
      {tab === 'emis' && (
        <PartagesTable
          partages={emis}
          loading={fetchingEmis}
          emptyLabel="Aucun partage émis"
          renderActions={(p) =>
            p.actif ? (
              <ActionBtn color="orange" loading={revoquer.isPending} onClick={() => revoquer.mutate(p.id)}>Révoquer</ActionBtn>
            ) : null
          }
          colonnes={[
            { label: 'Document',   render: (p) => <DocLink partage={p} /> },
            { label: 'Dest.',      render: (p) => <FilialeChip code={p.filialeDest?.code} />, hideOnMobile: true },
            { label: 'Par',        render: (p) => <span className="text-sm text-muted-foreground">{p.autorisateur?.prenom} {p.autorisateur?.nom}</span>, hideOnMobile: true },
            { label: 'Statut',     render: (p) => <StatutBadge statut={p.statut} /> },
            { label: 'Expiration', render: (p) => <span className="text-xs text-muted-foreground">{p.expiresAt ? formatDate(p.expiresAt) : 'Permanent'}</span>, hideOnTablet: true },
          ]}
        />
      )}
    </motion.div>
  )
}

function StatutBadge({ statut }: { statut: StatutPartage }) {
  const { label, className } = STATUT_CONFIG[statut]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function FilialeChip({ code }: { code?: string }) {
  return (
    <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-muted rounded-md text-foreground">
      {code ?? '—'}
    </span>
  )
}

function DocLink({ partage }: { partage: PartageDetail }) {
  return (
    <Link to={`/documents/${partage.documentId}`}
      className="font-medium text-foreground hover:text-primary transition-colors text-sm line-clamp-1">
      {partage.document?.titre ?? partage.documentId}
    </Link>
  )
}

function ActionBtn({ color, loading, onClick, children }: {
  color: 'green' | 'red' | 'orange'
  loading: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const colors = {
    green:  'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20',
    red:    'bg-destructive/10 text-destructive hover:bg-destructive/20',
    orange: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      {children}
    </button>
  )
}

interface Colonne {
  label: string
  hideOnMobile?: boolean
  hideOnTablet?: boolean
  render: (p: PartageDetail) => React.ReactNode
}

function PartagesTable({ partages, loading, emptyLabel, colonnes, renderActions }: {
  partages: PartageDetail[]
  loading: boolean
  emptyLabel: string
  colonnes: Colonne[]
  renderActions: (p: PartageDetail) => React.ReactNode
}) {
  if (loading && !partages.length) {
    return (
      <div className="bg-card rounded-2xl border border-border flex items-center justify-center py-20 text-muted-foreground text-sm">
        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  if (!partages.length) {
    return (
      <div className="bg-card rounded-2xl border border-border text-center py-16">
        <Share2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  const colClass = (col: Colonne) =>
    col.hideOnMobile ? 'hidden sm:table-cell' : col.hideOnTablet ? 'hidden md:table-cell' : ''

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {colonnes.map((col) => (
                <th key={col.label} className={`py-3 px-4 first:pl-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider ${colClass(col)}`}>
                  {col.label}
                </th>
              ))}
              <th className="py-3 px-4 pr-5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {partages.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                {colonnes.map((col) => (
                  <td key={col.label} className={`py-3.5 px-4 first:pl-5 ${colClass(col)}`}>
                    {col.render(p)}
                  </td>
                ))}
                <td className="py-3.5 px-4 pr-5 text-right">
                  {renderActions(p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
