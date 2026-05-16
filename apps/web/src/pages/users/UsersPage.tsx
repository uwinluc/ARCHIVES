import { FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, UserCheck, UserX } from 'lucide-react'
import { useUsers, useUserMutations } from '../../hooks/useUsers'
import { useFiliales } from '../../hooks/useFiliales'
import { useAuth } from '../../contexts/AuthContext'
import type { Role, UserProfile } from '@gi/shared-types'

type CreatableRole = Exclude<Role, 'SUPER_ADMIN'>

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN_FILIALE: 'Admin Filiale', ARCHIVISTE: 'Archiviste',
  MANAGER: 'Manager', COLLABORATEUR: 'Collaborateur', LECTEUR: 'Lecteur',
}

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN:   'bg-purple-50 text-purple-700 border border-purple-100',
  ADMIN_FILIALE: 'bg-blue-50 text-blue-700 border border-blue-100',
  ARCHIVISTE:    'bg-amber-50 text-amber-700 border border-amber-100',
  MANAGER:       'bg-emerald-50 text-emerald-700 border border-emerald-100',
  COLLABORATEUR: 'bg-slate-50 text-slate-600 border border-slate-200',
  LECTEUR:       'bg-slate-50 text-slate-500 border border-slate-200',
}

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-violet-600',
  'from-pink-500 to-rose-600',
]

const CREATABLE_ROLES: CreatableRole[] = ['ADMIN_FILIALE', 'ARCHIVISTE', 'MANAGER', 'COLLABORATEUR', 'LECTEUR']

function getAvatarColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const color = getAvatarColor(name)
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'
  return (
    <div className={`${dim} rounded-xl flex items-center justify-center font-bold text-white shrink-0 bg-gradient-to-br ${color}`}>
      {initials}
    </div>
  )
}

export function UsersPage() {
  const { profile } = useAuth()
  const rank = profile ? ROLE_RANK[profile.role] ?? 0 : 0
  const canManage = rank >= ROLE_RANK['ADMIN_FILIALE']

  const { data: users = [], isFetching } = useUsers()
  const { data: filiales = [] } = useFiliales()
  const { create, update } = useUserMutations()

  const [showCreate, setShowCreate] = useState(false)
  const [editRole, setEditRole] = useState<{ user: UserProfile; role: CreatableRole } | null>(null)
  const [search, setSearch] = useState('')

  const filtered = users.filter((u) =>
    `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  )

  const filialeMap = Object.fromEntries(filiales.map((f) => [f.id, f]))
  const activeCount = users.filter((u) => u.actif).length

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{activeCount}</span> utilisateur{activeCount !== 1 ? 's' : ''} actif{activeCount !== 1 ? 's' : ''}
        </p>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md active:scale-95"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
          >
            <Plus className="w-4 h-4" />
            Nouvel utilisateur
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-card rounded-2xl border border-border px-4 py-3.5">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isFetching && !users.length ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Search className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-sm">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 pl-5 pr-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Utilisateur</th>
                <th className="py-3 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="py-3 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Rôle</th>
                <th className="py-3 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Filiale</th>
                <th className="py-3 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                {canManage && <th className="py-3 pl-3 pr-5 text-right" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} className={`hover:bg-muted/40 transition-colors group ${!user.actif ? 'opacity-50' : ''}`}>
                  <td className="py-3.5 pl-5 pr-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={`${user.prenom} ${user.nom}`} />
                      <div>
                        <p className="font-semibold text-foreground text-sm">{user.prenom} {user.nom}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-muted-foreground hidden md:table-cell">{user.email}</td>
                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_STYLE[user.role] ?? ''}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 hidden lg:table-cell">
                    {user.filialeId ? (
                      <span className="font-mono text-xs font-bold bg-muted px-2 py-1 rounded-md text-foreground tracking-wider">
                        {filialeMap[user.filialeId]?.code ?? '—'}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-purple-600">Groupe</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      user.actif
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.actif ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                      {user.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  {canManage && user.role !== 'SUPER_ADMIN' && (
                    <td className="py-3.5 pl-3 pr-5">
                      <div className="flex items-center justify-end gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditRole({ user, role: user.role as CreatableRole })}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:bg-accent transition-colors"
                        >
                          Rôle
                        </button>
                        {user.actif ? (
                          <button
                            onClick={() => update.mutate({ id: user.id, dto: { actif: false } })}
                            disabled={update.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-100 disabled:opacity-50 transition-colors"
                          >
                            <UserX className="w-3 h-3" />
                            Désactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => update.mutate({ id: user.id, dto: { actif: true } })}
                            disabled={update.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 disabled:opacity-50 transition-colors"
                          >
                            <UserCheck className="w-3 h-3" />
                            Réactiver
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {canManage && user.role === 'SUPER_ADMIN' && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateUserDialog
          filiales={filiales}
          onClose={() => setShowCreate(false)}
          onSubmit={(dto) => create.mutate(dto, { onSuccess: () => setShowCreate(false) })}
          isPending={create.isPending}
        />
      )}

      {editRole && (
        <EditRoleDialog
          user={editRole.user}
          currentRole={editRole.role}
          onClose={() => setEditRole(null)}
          onSubmit={(role) =>
            update.mutate({ id: editRole.user.id, dto: { role } }, { onSuccess: () => setEditRole(null) })
          }
          isPending={update.isPending}
        />
      )}
    </motion.div>
  )
}

/* ── Dialogs ───────────────────────────────────────────────────── */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-lg leading-none">
            ×
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

function CreateUserDialog({ filiales, onClose, onSubmit, isPending }: {
  filiales: { id: string; code: string; nom: string }[]
  onClose: () => void
  onSubmit: (dto: { email: string; prenom: string; nom: string; filialeId: string; role: CreatableRole }) => void
  isPending: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      onSubmit({
        email: fd.get('email') as string,
        prenom: (fd.get('prenom') as string).trim(),
        nom: (fd.get('nom') as string).trim(),
        filialeId: fd.get('filialeId') as string,
        role: fd.get('role') as CreatableRole,
      })
    } catch { setError('Erreur lors de la création.') }
  }

  const fieldCls = 'w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all'

  return (
    <ModalShell title="Nouvel utilisateur" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Prénom *</label>
            <input name="prenom" required className={fieldCls} placeholder="Aminata" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Nom *</label>
            <input name="nom" required className={fieldCls} placeholder="DIALLO" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Email *</label>
          <input name="email" type="email" required className={fieldCls} placeholder="prenom.nom@groupe-gi.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Filiale *</label>
            <select name="filialeId" required className={`${fieldCls} bg-background`}>
              <option value="">Choisir…</option>
              {filiales.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Rôle *</label>
            <select name="role" required defaultValue="COLLABORATEUR" className={`${fieldCls} bg-background`}>
              {CREATABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={isPending}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 flex items-center gap-2 transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
            {isPending && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Créer
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditRoleDialog({ user, currentRole, onClose, onSubmit, isPending }: {
  user: UserProfile
  currentRole: CreatableRole
  onClose: () => void
  onSubmit: (role: CreatableRole) => void
  isPending: boolean
}) {
  const [role, setRole] = useState<CreatableRole>(currentRole)

  return (
    <ModalShell title="Modifier le rôle" onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
          <UserAvatar name={`${user.prenom} ${user.nom}`} size="sm" />
          <div>
            <p className="text-sm font-semibold text-foreground">{user.prenom} {user.nom}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="space-y-2">
          {CREATABLE_ROLES.map((r) => (
            <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              role === r ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted'
            }`}>
              <input type="radio" name="role" value={r} checked={role === r}
                onChange={() => setRole(r)} className="accent-blue-600" />
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${ROLE_STYLE[r] ?? ''}`}>
                {ROLE_LABELS[r]}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
            Annuler
          </button>
          <button onClick={() => onSubmit(role)} disabled={isPending || role === currentRole}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
            {isPending && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
