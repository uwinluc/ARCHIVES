import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, ChevronRight, FolderOpen, Folder } from 'lucide-react'
import { useCategories, useCategorieMutations } from '../../hooks/useCategories'
import { useAuth } from '../../contexts/AuthContext'
import type { Categorie } from '@gi/shared-types'

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

function toCode(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
}

export function CategoriesPage() {
  const { profile } = useAuth()
  const rank = profile ? ROLE_RANK[profile.role] ?? 0 : 0
  const canManage = rank >= ROLE_RANK['ADMIN_FILIALE']

  const { data: categories = [], isFetching } = useCategories()
  const { create, update, deactivate } = useCategorieMutations()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Categorie | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const roots = categories.filter((c) => !c.parentId)
  const activeCount = categories.filter((c) => c.actif).length

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  return (
    <motion.div
      className="max-w-4xl space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Catégories</h1>
          {!isFetching && (
            <p className="text-sm text-muted-foreground mt-1">{activeCount} active{activeCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle catégorie
          </button>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isFetching && !categories.length ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
            Chargement…
          </div>
        ) : roots.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune catégorie</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Catégorie</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Conservation</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Portée</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                {canManage && <th className="px-4 py-3 text-right" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roots.map((cat) => {
                const hasChildren = cat.children && cat.children.length > 0
                const isExpanded = expanded.has(cat.id)
                return [
                  <CategorieRow
                    key={cat.id}
                    cat={cat}
                    depth={0}
                    hasChildren={!!hasChildren}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(cat.id)}
                    canManage={canManage}
                    onEdit={() => setEditing(cat)}
                    onDeactivate={() => deactivate.mutate(cat.id)}
                    isPending={deactivate.isPending}
                  />,
                  ...(hasChildren && isExpanded
                    ? cat.children!.map((child) => (
                        <CategorieRow
                          key={child.id}
                          cat={child}
                          depth={1}
                          hasChildren={false}
                          isExpanded={false}
                          onToggle={() => {}}
                          canManage={canManage}
                          onEdit={() => setEditing(child)}
                          onDeactivate={() => deactivate.mutate(child.id)}
                          isPending={deactivate.isPending}
                        />
                      ))
                    : []),
                ]
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CategorieDialog
          categories={roots.filter((c) => c.actif)}
          onClose={() => setShowCreate(false)}
          onSubmit={(dto) => create.mutate(dto, { onSuccess: () => setShowCreate(false) })}
          isPending={create.isPending}
        />
      )}

      {editing && (
        <CategorieDialog
          initial={editing}
          categories={roots.filter((c) => c.actif && c.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSubmit={(dto) => update.mutate({ id: editing.id, dto }, { onSuccess: () => setEditing(null) })}
          isPending={update.isPending}
        />
      )}
    </motion.div>
  )
}

interface RowProps {
  cat: Categorie
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
  canManage: boolean
  onEdit: () => void
  onDeactivate: () => void
  isPending: boolean
}

function CategorieRow({ cat, depth, hasChildren, isExpanded, onToggle, canManage, onEdit, onDeactivate, isPending }: RowProps) {
  const Icon = hasChildren ? (isExpanded ? FolderOpen : Folder) : null
  return (
    <tr className={`hover:bg-muted/40 transition-colors group ${!cat.actif ? 'opacity-50' : ''}`}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
          {hasChildren ? (
            <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          ) : depth > 0 ? (
            <span className="w-4 h-4 shrink-0 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
            </span>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="font-medium text-foreground">{cat.libelle}</span>
          {hasChildren && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
              {cat.children!.length}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">{cat.code}</td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {cat.dureeConservationAns ? `${cat.dureeConservationAns} an${cat.dureeConservationAns > 1 ? 's' : ''}` : '—'}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
          cat.filialeId ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'
        }`}>
          {cat.filialeId ? 'Filiale' : 'Groupe'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
          cat.actif ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
        }`}>
          {cat.actif ? 'Active' : 'Inactive'}
        </span>
      </td>
      {canManage && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
            >
              Modifier
            </button>
            {cat.actif && (
              <button
                onClick={onDeactivate}
                disabled={isPending}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
              >
                Désactiver
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

interface DialogProps {
  initial?: Categorie
  categories: Categorie[]
  onClose: () => void
  onSubmit: (dto: { code: string; libelle: string; dureeConservationAns?: number; parentId?: string }) => void
  isPending: boolean
}

function CategorieDialog({ initial, categories, onClose, onSubmit, isPending }: DialogProps) {
  const [libelle, setLibelle] = useState(initial?.libelle ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [codeManual, setCodeManual] = useState(!!initial)
  const [duree, setDuree] = useState(initial?.dureeConservationAns?.toString() ?? '')
  const [parentId, setParentId] = useState(initial?.parentId ?? '')

  useEffect(() => {
    if (!codeManual) setCode(toCode(libelle))
  }, [libelle, codeManual])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      code: code.trim().toUpperCase(),
      libelle: libelle.trim(),
      dureeConservationAns: duree ? Number(duree) : undefined,
      parentId: parentId || undefined,
    })
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {initial ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none transition-colors">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Catégorie parente */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Catégorie parente</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={!!initial?.parentId}
              className={inputCls}
            >
              <option value="">— Catégorie racine —</option>
              {categories.filter((c) => !c.parentId).map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.libelle}</option>
              ))}
            </select>
          </div>

          {/* Libellé */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Libellé <span className="text-destructive">*</span>
            </label>
            <input
              required
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className={inputCls}
              placeholder="ex: Contrats commerciaux"
            />
          </div>

          {/* Code — auto-généré */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground">
                Code <span className="text-destructive">*</span>
              </label>
              {!initial && (
                <button
                  type="button"
                  onClick={() => { setCodeManual((m) => !m); if (codeManual) setCode(toCode(libelle)) }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {codeManual ? 'Générer automatiquement' : 'Modifier manuellement'}
                </button>
              )}
            </div>
            <input
              required
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeManual(true) }}
              maxLength={20}
              readOnly={!codeManual && !initial}
              className={`${inputCls} font-mono ${!codeManual && !initial ? 'bg-muted/50 text-muted-foreground cursor-default' : ''}`}
              placeholder="ex: CONTRAT"
            />
            {!codeManual && !initial && (
              <p className="text-xs text-muted-foreground mt-1">Généré automatiquement depuis le libellé</p>
            )}
          </div>

          {/* Durée de conservation */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Durée de conservation (ans)</label>
            <input
              type="number"
              min={1}
              max={999}
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
              className={inputCls}
              placeholder="Optionnel"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-60 flex items-center gap-2 transition-colors"
            >
              {isPending && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {initial ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
