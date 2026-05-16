import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Confidentialite, Document, Prisma, StatutDocument } from '@prisma/client'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../common/services/audit.service'
import { StorageService } from '../common/services/storage.service'
import { SearchService } from '../common/services/search.service'
import { EmailService } from '../common/services/email.service'
import { AuthenticatedUser } from '../auth/auth.types'
import { CreateDocumentDto } from './dto/create-document.dto'
import { UpdateDocumentDto } from './dto/update-document.dto'
import { QueryDocumentDto } from './dto/query-document.dto'

const MIME_WHITELIST = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/zip',
])

// Statuts visibles en lecture (hors DETRUIT pour les non-admins)
const VISIBLE_STATUTS: StatutDocument[] = [
  'BROUILLON', 'SOUMIS', 'REJETE', 'VALIDE', 'ARCHIVE', 'A_DETRUIRE',
]

export interface UploadedFile {
  buffer: Buffer
  filename: string
  mimetype: string
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly search: SearchService,
    private readonly email: EmailService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private assertFiliale(user: AuthenticatedUser, filialeId: string): void {
    if (user.role !== 'SUPER_ADMIN' && user.filialeId !== filialeId) {
      throw new ForbiddenException('Accès interdit à cette filiale')
    }
  }

  private assertStatut(doc: Document, expected: StatutDocument): void {
    if (doc.statut !== expected) {
      throw new BadRequestException(
        `Action impossible : le document est en statut "${doc.statut}" (attendu : "${expected}")`,
      )
    }
  }

  private filialeFilter(user: AuthenticatedUser): Prisma.DocumentWhereInput {
    if (user.role === 'SUPER_ADMIN') return {}
    return { filialeId: user.filialeId! }
  }

  private sha256(buffer: Buffer): string {
    return 'sha256:' + createHash('sha256').update(buffer).digest('hex')
  }

  private stripSensitiveFields(doc: Document & { currentVersion?: unknown }) {
    const { contenuOcr: _, ...safe } = doc
    return safe
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  async findAll(user: AuthenticatedUser, query: QueryDocumentDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = query
    const skip = (page - 1) * limit

    const where: Prisma.DocumentWhereInput = {
      ...this.filialeFilter(user),
      deletedAt: null,
      statut: filters.statut?.length ? { in: filters.statut } : { in: VISIBLE_STATUTS },
      ...(filters.categorieId && { categorieId: filters.categorieId }),
      ...(filters.confidentialite && { confidentialite: filters.confidentialite }),
      ...(filters.auteurId && { auteurId: filters.auteurId }),
      ...(filters.tags?.length && { tags: { hasSome: filters.tags } }),
      ...(filters.dateDocumentFrom || filters.dateDocumentTo
        ? {
            dateDocument: {
              ...(filters.dateDocumentFrom && { gte: new Date(filters.dateDocumentFrom) }),
              ...(filters.dateDocumentTo && { lte: new Date(filters.dateDocumentTo) }),
            },
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, titre: true, statut: true, confidentialite: true,
          categorieId: true, filialeId: true, auteurId: true,
          dateDocument: true, dateExpiration: true, tags: true,
          reference: true, createdAt: true, updatedAt: true,
          currentVersion: {
            select: { id: true, numero: true, taille: true, mimeType: true, createdAt: true },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        currentVersion: {
          select: { id: true, numero: true, taille: true, mimeType: true, checksum: true, createdAt: true },
        },
        categorie: { select: { id: true, code: true, libelle: true } },
        auteur: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    })

    if (!doc || doc.deletedAt) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)

    await this.audit.log({
      action: 'LECTURE',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: doc.id,
    })

    return this.stripSensitiveFields(doc)
  }

  async getVersions(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id }, select: { filialeId: true } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)

    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true, taille: true, mimeType: true, checksum: true, createdAt: true },
    })
  }

  async getDownloadUrl(user: AuthenticatedUser, id: string): Promise<string> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { currentVersion: true },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)
    if (doc.statut === 'DETRUIT') throw new ForbiddenException('Document détruit')
    if (!doc.currentVersion) throw new NotFoundException('Aucune version disponible')

    const bucket = this.storage.bucketName(doc.filialeId)
    const signedUrl = await this.storage.getSignedUrl(bucket, doc.currentVersion.storageKey)

    await this.audit.log({
      action: 'TELECHARGEMENT',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: doc.id,
      metadata: { versionId: doc.currentVersion.id },
    })

    return signedUrl
  }

  async getAuditLog(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id }, select: { filialeId: true } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)

    return this.prisma.auditLog.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, action: true, createdAt: true, metadata: true,
        user: { select: { id: true, prenom: true, nom: true } },
      },
    })
  }

  // ── Search (PostgreSQL full-text via Prisma) ──────────────────────────────

  async searchDocuments(user: AuthenticatedUser, q: string, query: QueryDocumentDto) {
    const filialeId = user.role === 'SUPER_ADMIN' ? null : user.filialeId!
    const page = query.page ?? 1
    const limit = query.limit ?? 20

    const { ids, total } = await this.search.search(
      q,
      filialeId,
      {
        statut: query.statut,
        confidentialite: query.confidentialite,
        categorieId: query.categorieId,
      },
      page,
      limit,
    )

    if (!ids.length) return { data: [], total: 0, page, limit }

    const docs = await this.prisma.document.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, titre: true, statut: true, confidentialite: true,
        categorieId: true, filialeId: true, auteurId: true,
        dateDocument: true, dateExpiration: true, tags: true,
        reference: true, createdAt: true, updatedAt: true,
        currentVersion: {
          select: { id: true, numero: true, taille: true, mimeType: true, createdAt: true },
        },
      },
    })

    const byId = new Map(docs.map((d: any) => [d.id, d]))
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean)

    return { data: ordered, total, page, limit }
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async create(user: AuthenticatedUser, dto: CreateDocumentDto, file: UploadedFile) {
    if (!MIME_WHITELIST.has(file.mimetype)) {
      throw new BadRequestException(`Type de fichier non autorisé : ${file.mimetype}`)
    }

    const filialeId = user.filialeId!
    const filialeCode = user.filialeCode!
    const checksum = this.sha256(file.buffer)
    const bucket = this.storage.bucketName(filialeCode)
    const storageKey = this.storage.buildStorageKey(file.filename)

    await this.storage.upload(bucket, storageKey, file.buffer, file.mimetype)

    const doc = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.document.create({
        data: {
          titre: dto.titre,
          description: dto.description,
          categorieId: dto.categorieId,
          filialeId,
          auteurId: user.id,
          confidentialite: dto.confidentialite,
          dateDocument: new Date(dto.dateDocument),
          tags: dto.tags ?? [],
          reference: dto.reference,
          auteurExterne: dto.auteurExterne,
        },
      })

      const version = await tx.documentVersion.create({
        data: {
          documentId: created.id,
          numero: 1,
          taille: BigInt(file.buffer.length),
          mimeType: file.mimetype,
          checksum,
          storageKey,
          uploadedById: user.id,
        },
      })

      return tx.document.update({
        where: { id: created.id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      })
    })

    await this.audit.log({
      action: 'UPLOAD',
      userId: user.id,
      filialeId,
      documentId: doc.id,
      metadata: { filename: file.filename, taille: file.buffer.length, checksum },
    })

    return doc
  }

  // ── Update metadata ───────────────────────────────────────────────────────

  async update(user: AuthenticatedUser, id: string, dto: UpdateDocumentDto) {
    const doc = await this.prisma.document.findUnique({ where: { id } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)

    if (doc.statut === 'ARCHIVE' || doc.statut === 'DETRUIT') {
      throw new BadRequestException('Impossible de modifier un document archivé ou détruit')
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.titre && { titre: dto.titre }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categorieId && { categorieId: dto.categorieId }),
        ...(dto.confidentialite && { confidentialite: dto.confidentialite }),
        ...(dto.dateDocument && { dateDocument: new Date(dto.dateDocument) }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
        ...(dto.auteurExterne !== undefined && { auteurExterne: dto.auteurExterne }),
      },
    })

    await this.audit.log({
      action: 'MODIFICATION_META',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: id,
    })

    return updated
  }

  // ── Workflow ──────────────────────────────────────────────────────────────

  async soumettre(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)

    if (doc.auteurId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException("Seul l'auteur peut soumettre ce document")
    }
    this.assertStatut(doc, 'BROUILLON')

    const updated = await this.prisma.document.update({
      where: { id },
      data: { statut: 'SOUMIS' },
    })

    await this.audit.log({ action: 'SOUMISSION', userId: user.id, filialeId: doc.filialeId, documentId: id })
    await this.email.notifierSoumission(doc.titre, doc.filialeId)
    return updated
  }

  async valider(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        categorie: true,
        auteur: { select: { email: true, prenom: true } },
      },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)
    this.assertStatut(doc, 'SOUMIS')

    let dateExpiration: Date | null = null
    if (doc.categorie.dureeConservationAns) {
      dateExpiration = new Date(doc.dateDocument)
      dateExpiration.setFullYear(dateExpiration.getFullYear() + doc.categorie.dureeConservationAns)
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { statut: 'VALIDE', dateExpiration },
    })

    await this.audit.log({ action: 'VALIDATION', userId: user.id, filialeId: doc.filialeId, documentId: id })
    await this.email.notifierValidation(doc.auteur.email, doc.auteur.prenom, doc.titre)
    return updated
  }

  async rejeter(user: AuthenticatedUser, id: string, motif: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { auteur: { select: { email: true, prenom: true } } },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)
    this.assertStatut(doc, 'SOUMIS')

    const updated = await this.prisma.document.update({
      where: { id },
      data: { statut: 'REJETE' },
    })

    await this.audit.log({
      action: 'REJET',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: id,
      metadata: { motif },
    })
    await this.email.notifierRejet(doc.auteur.email, doc.auteur.prenom, doc.titre, motif)
    return updated
  }

  async archiver(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)
    this.assertStatut(doc, 'VALIDE')

    const updated = await this.prisma.document.update({
      where: { id },
      data: { statut: 'ARCHIVE' },
    })

    await this.audit.log({ action: 'ARCHIVAGE', userId: user.id, filialeId: doc.filialeId, documentId: id })
    return updated
  }

  async proposerDestruction(user: AuthenticatedUser, id: string, justification: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)
    this.assertStatut(doc, 'ARCHIVE')

    const updated = await this.prisma.document.update({
      where: { id },
      data: { statut: 'A_DETRUIRE' },
    })

    await this.audit.log({
      action: 'PROPOSITION_DESTRUCTION',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: id,
      metadata: { justification },
    })
    await this.email.notifierPropositionDestruction(doc.titre, doc.filialeId, justification)
    return updated
  }

  async confirmerDestruction(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { currentVersion: true, categorie: true },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)
    this.assertStatut(doc, 'A_DETRUIRE')

    const propositionLog = await this.prisma.auditLog.findFirst({
      where: { documentId: id, action: 'PROPOSITION_DESTRUCTION' },
      orderBy: { createdAt: 'desc' },
    })

    if (propositionLog?.userId === user.id) {
      throw new ForbiddenException('La double validation requiert deux personnes différentes')
    }

    const bucket = this.storage.bucketName(user.filialeCode ?? doc.filialeId)

    await this.prisma.$transaction(async (tx: any) => {
      await tx.certificatDestruction.create({
        data: {
          documentId: id,
          titreDocument: doc.titre,
          categorieCode: doc.categorie.code,
          filialeId: doc.filialeId,
          checksumFichier: doc.currentVersion?.checksum ?? '',
          dateCreation: doc.createdAt,
          validateur1Id: propositionLog?.userId ?? user.id,
          validateur2Id: user.id,
          pdfStorageKey: `certificats/${id}-destruction.pdf`,
        },
      })

      await tx.document.update({
        where: { id },
        data: { statut: 'DETRUIT', currentVersionId: null },
      })
    })

    if (doc.currentVersion) {
      await this.storage.delete(bucket, doc.currentVersion.storageKey)
    }

    await this.audit.log({
      action: 'DESTRUCTION',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: id,
      metadata: { validateur1: propositionLog?.userId, validateur2: user.id },
    })
  }

  // ── Nouvelle version ──────────────────────────────────────────────────────

  async nouvelleVersion(user: AuthenticatedUser, id: string, file: UploadedFile) {
    if (!MIME_WHITELIST.has(file.mimetype)) {
      throw new BadRequestException(`Type de fichier non autorisé : ${file.mimetype}`)
    }

    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { numero: 'desc' }, take: 1 } },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)

    if (doc.statut === 'ARCHIVE' || doc.statut === 'DETRUIT') {
      throw new BadRequestException("Impossible d'ajouter une version à un document archivé ou détruit")
    }

    const nextNumero = (doc.versions[0]?.numero ?? 0) + 1
    const checksum = this.sha256(file.buffer)
    const filialeCode = user.filialeCode ?? doc.filialeId
    const bucket = this.storage.bucketName(filialeCode)
    const storageKey = this.storage.buildStorageKey(file.filename)

    await this.storage.upload(bucket, storageKey, file.buffer, file.mimetype)

    const updated = await this.prisma.$transaction(async (tx: any) => {
      const version = await tx.documentVersion.create({
        data: {
          documentId: id,
          numero: nextNumero,
          taille: BigInt(file.buffer.length),
          mimeType: file.mimetype,
          checksum,
          storageKey,
          uploadedById: user.id,
        },
      })

      return tx.document.update({
        where: { id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      })
    })

    await this.audit.log({
      action: 'NOUVELLE_VERSION',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: id,
      metadata: { numero: nextNumero, filename: file.filename, checksum },
    })

    return updated
  }

  // ── Suppression brouillon ─────────────────────────────────────────────────

  async remove(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertFiliale(user, doc.filialeId)

    if (doc.statut !== 'BROUILLON') {
      throw new BadRequestException('Seuls les brouillons peuvent être mis à la corbeille')
    }
    if (doc.auteurId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException("Seul l'auteur peut supprimer ce brouillon")
    }

    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  // ── Corbeille ─────────────────────────────────────────────────────────────

  async findCorbeille(user: AuthenticatedUser) {
    return this.prisma.document.findMany({
      where: {
        ...this.filialeFilter(user),
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true, titre: true, statut: true, filialeId: true,
        auteurId: true, dateDocument: true, deletedAt: true, createdAt: true,
        categorie: { select: { libelle: true, code: true } },
        auteur: { select: { prenom: true, nom: true } },
      },
    })
  }

  async restaurer(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { filialeId: true, auteurId: true, deletedAt: true },
    })
    if (!doc?.deletedAt) throw new NotFoundException('Document introuvable dans la corbeille')
    this.assertFiliale(user, doc.filialeId)
    if (doc.auteurId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException("Seul l'auteur peut restaurer ce document")
    }

    return this.prisma.document.update({
      where: { id },
      data: { deletedAt: null },
    })
  }

  async purger(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { currentVersion: true },
    })
    if (!doc?.deletedAt) throw new NotFoundException('Document introuvable dans la corbeille')
    this.assertFiliale(user, doc.filialeId)

    const bucket = this.storage.bucketName(user.filialeCode ?? doc.filialeId)

    await this.prisma.$transaction(async (tx: any) => {
      await tx.document.update({ where: { id }, data: { currentVersionId: null } })
      await tx.documentVersion.deleteMany({ where: { documentId: id } })
      await tx.document.delete({ where: { id } })
    })

    if (doc.currentVersion) {
      await this.storage.delete(bucket, doc.currentVersion.storageKey)
    }
  }
}
