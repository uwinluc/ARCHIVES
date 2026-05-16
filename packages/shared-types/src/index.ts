// ── Enums ──────────────────────────────────────────────────────────────────

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN_FILIALE'
  | 'ARCHIVISTE'
  | 'MANAGER'
  | 'COLLABORATEUR'
  | 'LECTEUR'

export type StatutDocument =
  | 'BROUILLON'
  | 'SOUMIS'
  | 'REJETE'
  | 'VALIDE'
  | 'ARCHIVE'
  | 'A_DETRUIRE'
  | 'DETRUIT'

export type Confidentialite = 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL' | 'SECRET'

export type StatutPartage = 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE' | 'EXPIRE' | 'REVOQUE'

export type ActionAudit =
  | 'CONNEXION'
  | 'DECONNEXION'
  | 'UPLOAD'
  | 'LECTURE'
  | 'TELECHARGEMENT'
  | 'MODIFICATION_META'
  | 'NOUVELLE_VERSION'
  | 'SOUMISSION'
  | 'VALIDATION'
  | 'REJET'
  | 'ARCHIVAGE'
  | 'PROPOSITION_DESTRUCTION'
  | 'VALIDATION_DESTRUCTION'
  | 'DESTRUCTION'
  | 'PARTAGE_CREATION'
  | 'PARTAGE_VALIDATION'
  | 'PARTAGE_ACCES'
  | 'PARTAGE_REVOCATION'
  | 'EXPORT'
  | 'IMPERSONATION'

// ── Authenticated user (shared between API guards and frontend context) ───

export interface AuthenticatedUser {
  id: string
  email: string
  filialeId: string | null
  filialeCode: string | null
  role: Role
}

// ── JWT Claims (Supabase app_metadata) ────────────────────────────────────

export interface JwtClaims {
  sub: string
  email: string
  app_metadata: {
    filiale_id: string | null // null = SUPER_ADMIN
    filiale_code: string | null
    role: Role
  }
}

// ── Entités ────────────────────────────────────────────────────────────────

export interface Filiale {
  id: string
  code: string
  nom: string
  pays: string
  actif: boolean
  createdAt: string
}

export interface UserProfile {
  id: string
  email: string
  prenom: string
  nom: string
  filialeId: string | null
  role: Role
  actif: boolean
}

export interface Categorie {
  id: string
  code: string
  libelle: string
  dureeConservationAns: number | null
  filialeId: string | null
  parentId: string | null
  actif: boolean
  children?: Categorie[]
}

export interface DocumentVersion {
  id: string
  numero: number
  taille: number
  mimeType: string
  checksum: string
  createdAt: string
}

export interface Document {
  id: string
  titre: string
  description: string | null
  categorieId: string
  filialeId: string
  auteurId: string
  statut: StatutDocument
  confidentialite: Confidentialite
  dateDocument: string
  dateExpiration: string | null
  tags: string[]
  reference: string | null
  auteurExterne: string | null
  currentVersion: DocumentVersion | null
  createdAt: string
  updatedAt: string
}

export interface PartageInterFiliale {
  id: string
  documentId: string
  filialeSrcId: string
  filialeDestId: string
  autorisePar: string
  statut: StatutPartage
  expiresAt: string | null
  actif: boolean
  createdAt: string
  updatedAt: string
}

export interface PartageDetail extends PartageInterFiliale {
  document?: { titre: string; statut: StatutDocument; confidentialite: Confidentialite }
  filialeSrc?: { code: string; nom: string }
  filialeDest?: { code: string; nom: string }
  autorisateur?: { prenom: string; nom: string }
}

// ── Stats ──────────────────────────────────────────────────────────────────

export interface StatsGlobal {
  totalDocuments: number
  parStatut: Partial<Record<StatutDocument, number>>
  aDetruire: number
  expirantIn90j: number
}

export interface StatsFiliale {
  filiale: { id: string; code: string; nom: string; pays: string }
  totalDocuments: number
  parStatut: Partial<Record<StatutDocument, number>>
  aDetruire: number
  expirantIn90j: number
}

export interface StatsActivite {
  id: string
  action: ActionAudit
  documentId: string | null
  createdAt: string
  user: { prenom: string; nom: string }
  document: { titre: string } | null
}

export interface StatsResponse {
  global: StatsGlobal
  parFiliale: StatsFiliale[]
  activiteRecente: StatsActivite[]
}

// ── Pagination ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ── Queues BullMQ ──────────────────────────────────────────────────────────

export interface OcrJobData {
  documentId: string
  versionId: string
  storageKey: string
  filialeCode: string
  mimeType: string
}

export interface IndexJobData {
  documentId: string
  action: 'upsert' | 'delete'
}
