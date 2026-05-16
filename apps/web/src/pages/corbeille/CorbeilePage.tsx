import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'

interface DocCorbeille {
  id: string
  titre: string
  statut: string
  filialeId: string
  auteurId: string
  dateDocument: string
  deletedAt: string
  createdAt: string
  categorie: { libelle: string; code: string }
  auteur: { prenom: string; nom: string }
}

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

export function CorbeilePage() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const rank = profile ? ROLE_RANK[profile.role] ?? 0 : 0
  const canPurge = rank >= ROLE_RANK['ADMIN_FILIALE']
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['corbeille'],
    queryFn: async () => {
      const { data } = await api.get<DocCorbeille[]>('/documents/corbeille')
      return data
    },
  })

  const restaurer = useMutation({
    mutationFn: (id: string) => api.post(`/documents/${id}/restaurer`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corbeille'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const purger = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}/purger`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corbeille'] })
      setConfirmPurgeId(null)
    },
  })

  return (
    <motion.div
      className="max-w-5xl space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Corbeille</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documents supprimés — restaurez-les ou supprimez-les définitivement.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
          Chargement…
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border py-20 text-center">
          <Trash2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-foreground font-medium">La corbeille est vide</p>
          <p className="text-muted-foreground text-sm mt-1">Les brouillons supprimés apparaîtront ici.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 border-b border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              {docs.length} document{docs.length > 1 ? 's' : ''} dans la corbeille
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Catégorie</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Auteur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Supprimé le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => {
                const isOwnDoc = profile?.id === doc.auteurId
                const canRestore = isOwnDoc || rank >= ROLE_RANK['SUPER_ADMIN']
                return (
                  <tr key={doc.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground truncate max-w-xs">{doc.titre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(doc.dateDocument).toLocaleDateString('fr-FR')}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden md:table-cell">
                      {doc.categorie.libelle}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden sm:table-cell">
                      {doc.auteur.prenom} {doc.auteur.nom}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground text-xs hidden lg:table-cell">
                      {formatDate(doc.deletedAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {canRestore && (
                          <button
                            onClick={() => restaurer.mutate(doc.id)}
                            disabled={restaurer.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 dark:text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restaurer
                          </button>
                        )}
                        {canPurge && (
                          <button
                            onClick={() => setConfirmPurgeId(doc.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Supprimer définitivement</span>
                            <span className="sm:hidden">Purger</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog confirmation purge */}
      {confirmPurgeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Suppression définitive</h3>
                <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Le document et tous ses fichiers seront supprimés définitivement du système.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmPurgeId(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                disabled={purger.isPending}
                onClick={() => purger.mutate(confirmPurgeId)}
                className="px-4 py-2 text-sm font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-xl disabled:opacity-60 flex items-center gap-2 transition-colors"
              >
                {purger.isPending && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
