import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDocument, useDocumentVersions, useDocumentAudit } from '../../hooks/useDocument'
import { useDocumentMutation } from '../../hooks/useDocuments'
import { usePartagesDocument, usePartageMutations } from '../../hooks/usePartages'
import { useFiliales } from '../../hooks/useFiliales'
import { useAuth } from '../../contexts/AuthContext'
import { StatutBadge } from '../../components/documents/StatutBadge'
import { PdfViewer } from '../../components/documents/PdfViewer'
import { api } from '../../lib/api'
import type { StatutDocument, StatutPartage } from '@gi/shared-types'

const STATUT_PARTAGE_CONFIG: Record<StatutPartage, { label: string; className: string }> = {
  EN_ATTENTE: { label: 'En attente',  className: 'bg-blue-50 text-blue-700'    },
  ACCEPTE:    { label: 'Accepté',     className: 'bg-green-50 text-green-700'  },
  REFUSE:     { label: 'Refusé',      className: 'bg-red-50 text-red-700'      },
  EXPIRE:     { label: 'Expiré',      className: 'bg-slate-100 text-slate-500' },
  REVOQUE:    { label: 'Révoqué',     className: 'bg-orange-50 text-orange-700'},
}

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const CONFIDENTIEL_LABELS: Record<string, string> = {
  PUBLIC: 'Public', INTERNE: 'Interne', CONFIDENTIEL: 'Confidentiel', SECRET: 'Secret',
}

interface CommentaireItem {
  id: string
  contenu: string
  createdAt: string
  updatedAt: string
  auteur: { id: string; prenom: string; nom: string; email: string }
}

const STATUT_TRANSITIONS: Record<StatutDocument, { action: string; label: string; minRole: string; color: 'blue' | 'green' | 'red' | 'amber' | 'orange' }[]> = {
  BROUILLON:  [{ action: 'soumettre', label: 'Soumettre', minRole: 'COLLABORATEUR', color: 'blue' }],
  SOUMIS:     [
    { action: 'valider', label: 'Valider', minRole: 'MANAGER', color: 'green' },
    { action: 'rejeter', label: 'Rejeter', minRole: 'MANAGER', color: 'red' },
  ],
  VALIDE:     [{ action: 'archiver', label: 'Archiver', minRole: 'ARCHIVISTE', color: 'amber' }],
  ARCHIVE:    [{ action: 'proposer-destruction', label: 'Proposer destruction', minRole: 'ARCHIVISTE', color: 'orange' }],
  A_DETRUIRE: [{ action: 'confirmer-destruction', label: 'Confirmer destruction', minRole: 'ADMIN_FILIALE', color: 'red' }],
  REJETE:     [{ action: 'soumettre', label: 'Resoumettre', minRole: 'COLLABORATEUR', color: 'blue' }],
  DETRUIT:    [],
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const rank = profile ? ROLE_RANK[profile.role] ?? 0 : 0

  const { data: doc, isLoading, error } = useDocument(id)
  const { data: versions = [] } = useDocumentVersions(id)
  const [showAudit, setShowAudit] = useState(false)
  const { data: auditLogs = [] } = useDocumentAudit(id, showAudit)

  const [downloading, setDownloading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const { soumettre, valider, rejeter, archiver, proposerDestruction, confirmerDestruction } = useDocumentMutation()

  const [rejetMotif, setRejetMotif] = useState('')
  const [showRejetDialog, setShowRejetDialog] = useState(false)
  const [justification, setJustification] = useState('')
  const [showDestructionDialog, setShowDestructionDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Commentaires
  const qc = useQueryClient()
  const [commentContenu, setCommentContenu] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContenu, setEditContenu] = useState('')

  const { data: commentaires = [] } = useQuery({
    queryKey: ['commentaires', id],
    queryFn: async () => {
      const { data } = await api.get<CommentaireItem[]>(`/documents/${id}/commentaires`)
      return data
    },
    enabled: !!id,
  })

  const addComment = useMutation({
    mutationFn: (contenu: string) => api.post(`/documents/${id}/commentaires`, { contenu }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commentaires', id] }); setCommentContenu('') },
  })

  const updateComment = useMutation({
    mutationFn: ({ cid, contenu }: { cid: string; contenu: string }) =>
      api.patch(`/commentaires/${cid}`, { contenu }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commentaires', id] }); setEditingCommentId(null) },
  })

  const deleteComment = useMutation({
    mutationFn: (cid: string) => api.delete(`/commentaires/${cid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commentaires', id] }),
  })

  // Partages
  const canShare = rank >= ROLE_RANK['ARCHIVISTE']
  const { data: partages = [] } = usePartagesDocument(canShare ? id : undefined)
  const { creer: creerPartage, revoquer } = usePartageMutations(id)
  const { data: filiales = [] } = useFiliales()
  const [showPartageDialog, setShowPartageDialog] = useState(false)
  const [partageFilialeDestId, setPartageFilialeDestId] = useState('')
  const [partageDuree, setPartageDuree] = useState<string>('30')

  // Nouvelle version
  const canNouvelleVersion = rank >= ROLE_RANK['COLLABORATEUR']
  const [showNouvelleVersion, setShowNouvelleVersion] = useState(false)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [versionError, setVersionError] = useState<string | null>(null)
  const nouvelleVersionRef = useRef<HTMLInputElement>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground text-sm">
        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="text-center py-32">
        <p className="text-muted-foreground text-sm">Document introuvable ou accès refusé.</p>
        <Link to="/documents" className="mt-4 inline-block text-primary text-sm hover:underline">
          ← Retour aux documents
        </Link>
      </div>
    )
  }

  const transitions = STATUT_TRANSITIONS[doc.statut] ?? []
  const isAuteur = profile?.id === doc.auteurId

  const canAct = (minRole: string) => rank >= (ROLE_RANK[minRole] ?? 999)
  const canDownload = doc.statut !== 'DETRUIT'
  const canEdit = doc.statut !== 'ARCHIVE' && doc.statut !== 'DETRUIT'
  const canAudit = rank >= ROLE_RANK['ARCHIVISTE']
  const showShareBtn = doc.statut === 'VALIDE' && canShare
  const showNouvelleVersionBtn = canNouvelleVersion && canEdit && doc.statut !== 'BROUILLON'

  const handleNouvelleVersion = async () => {
    const file = nouvelleVersionRef.current?.files?.[0]
    if (!file || !id) return
    setUploadingVersion(true)
    setVersionError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/documents/${id}/nouvelle-version`, fd)
      setShowNouvelleVersion(false)
      if (nouvelleVersionRef.current) nouvelleVersionRef.current.value = ''
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setVersionError(msg ?? 'Erreur lors de l\'upload.')
    } finally {
      setUploadingVersion(false)
    }
  }

  const handlePartager = () => {
    if (!partageFilialeDestId || !id) return
    creerPartage.mutate(
      {
        documentId: id,
        filialeDestId: partageFilialeDestId,
        dureeJours: partageDuree === 'permanent' ? undefined : Number(partageDuree),
      },
      {
        onSuccess: () => {
          setShowPartageDialog(false)
          setPartageFilialeDestId('')
          setPartageDuree('30')
        },
      },
    )
  }

  const handleAction = async (action: string) => {
    if (!id) return
    setActionLoading(action)
    try {
      if (action === 'soumettre') await soumettre.mutateAsync(id)
      else if (action === 'valider') await valider.mutateAsync(id)
      else if (action === 'rejeter') setShowRejetDialog(true)
      else if (action === 'archiver') await archiver.mutateAsync(id)
      else if (action === 'proposer-destruction') setShowDestructionDialog(true)
      else if (action === 'confirmer-destruction') await confirmerDestruction.mutateAsync(id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDownload = async () => {
    if (!id) return
    setDownloading(true)
    try {
      const { data: url } = await api.get<string>(`/documents/${id}/download`)
      window.open(url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  const isPdf = doc?.currentVersion?.mimeType === 'application/pdf'

  const handlePreview = async () => {
    if (!id) return
    setPreviewing(true)
    try {
      const { data: url } = await api.get<string>(`/documents/${id}/download`)
      setPreviewUrl(url)
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/documents" className="hover:text-foreground transition-colors">Documents</Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{doc.titre}</span>
      </div>

      {/* Header */}
      <div className="bg-card rounded-2xl border border-border px-5 py-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <StatutBadge statut={doc.statut} />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {CONFIDENTIEL_LABELS[doc.confidentialite]}
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-snug">{doc.titre}</h1>
            {doc.reference && (
              <p className="text-sm text-muted-foreground mt-1">Réf. {doc.reference}</p>
            )}
          </div>

          {/* Actions header */}
          <div className="flex items-center gap-2 flex-wrap">
            {showNouvelleVersionBtn && (
              <button
                onClick={() => setShowNouvelleVersion(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
              >
                Nouvelle version
              </button>
            )}
            {showShareBtn && (
              <button
                onClick={() => setShowPartageDialog(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
              >
                Partager
              </button>
            )}
            {isPdf && canDownload && (
              <button
                onClick={handlePreview}
                disabled={previewing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
              >
                {previewing ? <Spinner /> : <span>👁</span>}
                {previewing ? 'Chargement…' : 'Prévisualiser'}
              </button>
            )}
            {canDownload && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
              >
                {downloading ? <Spinner /> : <DownloadIcon />}
                {downloading ? 'Préparation…' : 'Télécharger'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-5">
          {/* Métadonnées */}
          <div className="bg-card rounded-2xl border border-border px-6 py-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Informations</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <MetaItem label="Catégorie" value={`${doc.categorie.libelle} (${doc.categorie.code})`} />
              <MetaItem label="Auteur" value={`${doc.auteur.prenom} ${doc.auteur.nom}`} />
              <MetaItem label="Date du document" value={formatDate(doc.dateDocument)} />
              <MetaItem label="Déposé le" value={formatDate(doc.createdAt)} />
              {doc.dateExpiration && (
                <MetaItem label="Expiration" value={formatDate(doc.dateExpiration)} highlight={new Date(doc.dateExpiration) <= new Date()} />
              )}
              {doc.auteurExterne && (
                <MetaItem label="Auteur externe" value={doc.auteurExterne} />
              )}
            </dl>

            {doc.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {doc.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {doc.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Description</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{doc.description}</p>
              </div>
            )}
          </div>

          {/* Versions */}
          {versions.length > 0 && (
            <div className="bg-card rounded-2xl border border-border px-6 py-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Historique des versions ({versions.length})
              </h2>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm ${
                      v.id === doc.currentVersion?.id
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-semibold text-xs ${
                        v.id === doc.currentVersion?.id ? 'text-blue-700' : 'text-slate-500'
                      }`}>
                        v{v.numero}
                        {v.id === doc.currentVersion?.id && (
                          <span className="ml-1.5 text-blue-600">(actuelle)</span>
                        )}
                      </span>
                      <span className="text-slate-500">{v.mimeType.split('/')[1]?.toUpperCase()}</span>
                      <span className="text-slate-400">{formatSize(v.taille)}</span>
                    </div>
                    <span className="text-slate-400 text-xs">{formatDate(v.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Partages (ARCHIVISTE+, doc VALIDE ou ayant eu des partages) */}
          {canShare && (doc.statut === 'VALIDE' || partages.length > 0) && (
            <div className="bg-card rounded-2xl border border-border px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">Partages inter-filiales</h2>
                {doc.statut === 'VALIDE' && (
                  <button
                    onClick={() => setShowPartageDialog(true)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    + Partager
                  </button>
                )}
              </div>
              {partages.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Aucun partage pour ce document</p>
              ) : (
                <div className="space-y-2">
                  {partages.map((p) => {
                    const cfg = STATUT_PARTAGE_CONFIG[p.statut]
                    return (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-xs bg-white border border-slate-200 px-2 py-0.5 rounded">
                            {p.filialeDest?.code}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
                            {cfg.label}
                          </span>
                          {p.expiresAt && (
                            <span className="text-slate-400 text-xs">
                              exp. {new Date(p.expiresAt).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                        {p.actif && (
                          <button
                            onClick={() => revoquer.mutate(p.id)}
                            disabled={revoquer.isPending}
                            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Révoquer
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Audit log */}
          {canAudit && (
            <div className="bg-card rounded-2xl border border-border px-6 py-5">
              <button
                onClick={() => setShowAudit((s) => !s)}
                className="flex items-center justify-between w-full text-left"
              >
                <h2 className="text-sm font-semibold text-slate-700">Journal d'audit</h2>
                <ChevronIcon open={showAudit} />
              </button>

              {showAudit && (
                <div className="mt-4 space-y-1">
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">Aucune entrée</p>
                  ) : (
                    auditLogs.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm">
                        <span className="text-slate-400 text-xs whitespace-nowrap pt-0.5">
                          {formatDateTime(entry.createdAt)}
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-slate-700">{entry.user.prenom} {entry.user.nom}</span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span className="text-slate-600">{formatAction(entry.action)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Commentaires */}
          <div className="bg-card rounded-2xl border border-border px-6 py-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Commentaires {commentaires.length > 0 && `(${commentaires.length})`}
            </h2>

            {commentaires.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-3">Aucun commentaire</p>
            ) : (
              <div className="space-y-4 mb-4">
                {commentaires.map((c) => (
                  <div key={c.id} className="flex gap-3 text-sm">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                      {c.auteur.prenom[0]}{c.auteur.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{c.auteur.prenom} {c.auteur.nom}</span>
                        <span className="text-xs text-slate-400">{formatDateTime(c.createdAt)}</span>
                        {c.updatedAt !== c.createdAt && (
                          <span className="text-xs text-slate-300 italic">modifié</span>
                        )}
                      </div>
                      {editingCommentId === c.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContenu}
                            onChange={(e) => setEditContenu(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              disabled={!editContenu.trim() || updateComment.isPending}
                              onClick={() => updateComment.mutate({ cid: c.id, contenu: editContenu })}
                              className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60"
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-slate-700 whitespace-pre-wrap">{c.contenu}</p>
                          {profile?.id === c.auteur.id && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => { setEditingCommentId(c.id); setEditContenu(c.contenu) }}
                                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => deleteComment.mutate(c.id)}
                                disabled={deleteComment.isPending}
                                className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50"
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rank >= ROLE_RANK['COLLABORATEUR'] && (
              <div className="flex gap-2 pt-3 border-t border-border">
                <textarea
                  value={commentContenu}
                  onChange={(e) => setCommentContenu(e.target.value)}
                  rows={2}
                  placeholder="Ajouter un commentaire…"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
                <button
                  disabled={!commentContenu.trim() || addComment.isPending}
                  onClick={() => addComment.mutate(commentContenu)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 self-end flex items-center gap-1.5"
                >
                  {addComment.isPending ? <Spinner /> : 'Envoyer'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-5">
          {/* Workflow */}
          {transitions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Actions</h2>
              <div className="space-y-2">
                {transitions.map((t) => {
                  const allowed = canAct(t.minRole) && (
                    t.action === 'soumettre' ? isAuteur || rank >= ROLE_RANK['SUPER_ADMIN'] : true
                  )
                  if (!allowed) return null
                  const isLoading = actionLoading === t.action
                  return (
                    <button
                      key={t.action}
                      onClick={() => handleAction(t.action)}
                      disabled={isLoading}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${btnClass(t.color)}`}
                    >
                      {isLoading && <Spinner />}
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Infos fichier courant */}
          {doc.currentVersion && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Fichier</h2>
              <dl className="space-y-2 text-sm">
                <MetaItem label="Format" value={doc.currentVersion.mimeType.split('/')[1]?.toUpperCase() ?? doc.currentVersion.mimeType} />
                <MetaItem label="Taille" value={formatSize(doc.currentVersion.taille)} />
                <MetaItem label="Version" value={`v${doc.currentVersion.numero}`} />
              </dl>
            </div>
          )}

          {/* Lien retour */}
          <button
            onClick={() => navigate(-1)}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-1"
          >
            ← Retour
          </button>
        </div>
      </div>

      {/* Dialog nouvelle version */}
      {showNouvelleVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Nouvelle version</h3>
            <p className="text-sm text-slate-500">Le fichier précédent sera conservé dans l'historique.</p>
            <input
              ref={nouvelleVersionRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tiff,.zip"
              className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {versionError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{versionError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNouvelleVersion(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Annuler
              </button>
              <button
                disabled={uploadingVersion}
                onClick={handleNouvelleVersion}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {uploadingVersion && <Spinner />}
                {uploadingVersion ? 'Upload…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog partage */}
      {showPartageDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Partager avec une filiale</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filiale destinataire</label>
              <select
                value={partageFilialeDestId}
                onChange={(e) => setPartageFilialeDestId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Choisir…</option>
                {filiales
                  .filter((f) => f.actif && f.id !== doc.filialeId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Durée d'accès</label>
              <select
                value={partageDuree}
                onChange={(e) => setPartageDuree(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="7">7 jours</option>
                <option value="30">30 jours</option>
                <option value="90">90 jours</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPartageDialog(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Annuler
              </button>
              <button
                disabled={!partageFilialeDestId || creerPartage.isPending}
                onClick={handlePartager}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {creerPartage.isPending && <Spinner />}
                Partager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog rejet */}
      {showRejetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Motif de rejet</h3>
            <textarea
              value={rejetMotif}
              onChange={(e) => setRejetMotif(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              placeholder="Expliquer la raison du rejet…"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejetDialog(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Annuler
              </button>
              <button
                disabled={!rejetMotif.trim() || rejeter.isPending}
                onClick={() =>
                  rejeter.mutate(
                    { id: id!, motif: rejetMotif },
                    { onSuccess: () => { setShowRejetDialog(false); setRejetMotif('') } },
                  )
                }
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog proposer destruction */}
      {showDestructionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Proposer la destruction</h3>
            <p className="text-sm text-slate-500">Cette action requiert une double validation avant destruction définitive.</p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              placeholder="Justification (durée de conservation atteinte, décision judiciaire…)"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDestructionDialog(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Annuler
              </button>
              <button
                disabled={!justification.trim() || proposerDestruction.isPending}
                onClick={() =>
                  proposerDestruction.mutate(
                    { id: id!, justification },
                    { onSuccess: () => { setShowDestructionDialog(false); setJustification('') } },
                  )
                }
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-60"
              >
                Proposer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer overlay */}
      {previewUrl && (
        <PdfViewer url={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  )
}

// ── Sous-composants ──────────────────────────────────────────────────────────

function MetaItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 mb-0.5">{label}</dt>
      <dd className={`font-medium ${highlight ? 'text-red-600' : 'text-slate-800'}`}>{value}</dd>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

function btnClass(color: 'blue' | 'green' | 'red' | 'amber' | 'orange') {
  const map = {
    blue:   'bg-blue-600 hover:bg-blue-700 text-white',
    green:  'bg-green-600 hover:bg-green-700 text-white',
    red:    'bg-red-600 hover:bg-red-700 text-white',
    amber:  'bg-amber-500 hover:bg-amber-600 text-white',
    orange: 'bg-orange-600 hover:bg-orange-700 text-white',
  }
  return map[color]
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    CONNEXION: 'Connexion', DECONNEXION: 'Déconnexion', UPLOAD: 'Dépôt',
    LECTURE: 'Consultation', TELECHARGEMENT: 'Téléchargement',
    MODIFICATION_META: 'Modification des métadonnées', NOUVELLE_VERSION: 'Nouvelle version',
    SOUMISSION: 'Soumission', VALIDATION: 'Validation', REJET: 'Rejet',
    ARCHIVAGE: 'Archivage', PROPOSITION_DESTRUCTION: 'Proposition de destruction',
    VALIDATION_DESTRUCTION: 'Validation de destruction', DESTRUCTION: 'Destruction',
    PARTAGE_CREATION: 'Création de partage', PARTAGE_VALIDATION: 'Validation de partage',
    PARTAGE_ACCES: 'Accès partagé', PARTAGE_REVOCATION: 'Révocation de partage',
    EXPORT: 'Export', IMPERSONATION: 'Impersonation',
  }
  return labels[action] ?? action
}
