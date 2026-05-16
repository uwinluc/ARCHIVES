import { FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Building2, Globe, Calendar, Edit2, PowerOff } from 'lucide-react'
import { useFiliales, useFilialeMutations } from '../../hooks/useFiliales'
import type { Filiale } from '@gi/shared-types'

const FILIALE_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-violet-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-blue-600',
]

function getFilialeColor(code: string) {
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash)
  return FILIALE_COLORS[Math.abs(hash) % FILIALE_COLORS.length]
}

export function FilialessPage() {
  const { data: filiales = [], isFetching } = useFiliales()
  const { create, update, deactivate } = useFilialeMutations()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Filiale | null>(null)

  const active   = filiales.filter((f) => f.actif)
  const inactive = filiales.filter((f) => !f.actif)

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{active.length}</span> filiale{active.length !== 1 ? 's' : ''} active{active.length !== 1 ? 's' : ''}
          {inactive.length > 0 && <span className="ml-1 text-muted-foreground">· {inactive.length} inactive{inactive.length !== 1 ? 's' : ''}</span>}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md active:scale-95"
          style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
        >
          <Plus className="w-4 h-4" />
          Nouvelle filiale
        </button>
      </div>

      {/* Grid de cartes */}
      {isFetching && !filiales.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border h-36 animate-pulse" />
          ))}
        </div>
      ) : filiales.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Building2 className="w-6 h-6 opacity-40" />
          </div>
          <p className="text-sm">Aucune filiale</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...active, ...inactive].map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className={`bg-card rounded-2xl border border-border overflow-hidden card-hover group ${!f.actif ? 'opacity-60' : ''}`}
            >
              {/* Header coloré */}
              <div className={`h-2 bg-gradient-to-r ${getFilialeColor(f.code)}`} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 bg-gradient-to-br ${getFilialeColor(f.code)}`}>
                      {f.code.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-muted-foreground tracking-widest uppercase">{f.code}</p>
                      <p className="font-bold text-foreground text-sm leading-tight mt-0.5">{f.nom}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    f.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${f.actif ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                    {f.actif ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="w-3.5 h-3.5" />
                    {f.pays}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    Créée le {new Date(f.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(f)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-muted text-foreground hover:bg-accent transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    Modifier
                  </button>
                  {f.actif && (
                    <button
                      onClick={() => deactivate.mutate(f.id)}
                      disabled={deactivate.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-100 disabled:opacity-50 transition-colors"
                    >
                      <PowerOff className="w-3 h-3" />
                      Désactiver
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && (
        <FilialeDialog
          onClose={() => setShowCreate(false)}
          onSubmit={(dto) => create.mutate(dto, { onSuccess: () => setShowCreate(false) })}
          isPending={create.isPending}
        />
      )}

      {editing && (
        <FilialeDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(dto) => update.mutate({ id: editing.id, dto }, { onSuccess: () => setEditing(null) })}
          isPending={update.isPending}
        />
      )}
    </motion.div>
  )
}

interface DialogProps {
  initial?: Filiale
  onClose: () => void
  onSubmit: (dto: { code: string; nom: string; pays: string }) => void
  isPending: boolean
}

function FilialeDialog({ initial, onClose, onSubmit, isPending }: DialogProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSubmit({
      code: (fd.get('code') as string).trim().toUpperCase(),
      nom:  (fd.get('nom') as string).trim(),
      pays: (fd.get('pays') as string).trim(),
    })
  }

  const fieldCls = 'w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">
            {initial ? 'Modifier la filiale' : 'Nouvelle filiale'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-lg">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Code *</label>
            <input name="code" required maxLength={20} defaultValue={initial?.code}
              className={`${fieldCls} font-mono uppercase`} placeholder="ex: FOMI" />
            <p className="mt-1.5 text-xs text-muted-foreground">Identifiant unique · Immuable après création</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Nom complet *</label>
            <input name="nom" required defaultValue={initial?.nom} className={fieldCls}
              placeholder="ex: Forestière et Mines de Guinée" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Pays *</label>
            <input name="pays" required defaultValue={initial?.pays} className={fieldCls} placeholder="ex: Guinée" />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isPending}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
              {isPending && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {initial ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
