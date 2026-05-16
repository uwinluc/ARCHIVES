import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../common/services/audit.service'
import { AuthenticatedUser } from '../auth/auth.types'
import { CreatePartageDto } from './dto/create-partage.dto'

@Injectable()
export class PartagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findPartage(id: string) {
    const p = await this.prisma.partageInterFiliale.findUnique({ where: { id } })
    if (!p) throw new NotFoundException('Partage introuvable')
    return p
  }

  private assertSrc(user: AuthenticatedUser, filialeSrcId: string) {
    if (user.role !== 'SUPER_ADMIN' && user.filialeId !== filialeSrcId) {
      throw new ForbiddenException('Accès interdit')
    }
  }

  private assertDest(user: AuthenticatedUser, filialeDestId: string) {
    if (user.role !== 'SUPER_ADMIN' && user.filialeId !== filialeDestId) {
      throw new ForbiddenException('Accès interdit')
    }
  }

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findByDocument(user: AuthenticatedUser, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { filialeId: true },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertSrc(user, doc.filialeId)

    return this.prisma.partageInterFiliale.findMany({
      where: { documentId },
      include: {
        filialeDest: { select: { code: true, nom: true } },
        autorisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findEmis(user: AuthenticatedUser) {
    const where = user.role === 'SUPER_ADMIN' ? {} : { filialeSrcId: user.filialeId! }

    return this.prisma.partageInterFiliale.findMany({
      where,
      include: {
        document: { select: { titre: true, statut: true, confidentialite: true } },
        filialeSrc: { select: { code: true, nom: true } },
        filialeDest: { select: { code: true, nom: true } },
        autorisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findRecus(user: AuthenticatedUser) {
    if (user.role === 'SUPER_ADMIN') return []

    return this.prisma.partageInterFiliale.findMany({
      where: { filialeDestId: user.filialeId!, actif: true },
      include: {
        document: { select: { titre: true, statut: true, confidentialite: true } },
        filialeSrc: { select: { code: true, nom: true } },
        autorisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async creer(user: AuthenticatedUser, dto: CreatePartageDto) {
    const doc = await this.prisma.document.findUnique({ where: { id: dto.documentId } })
    if (!doc) throw new NotFoundException('Document introuvable')
    this.assertSrc(user, doc.filialeId)

    if (doc.statut !== 'VALIDE') {
      throw new BadRequestException('Seuls les documents VALIDÉS peuvent être partagés')
    }
    if (dto.filialeDestId === doc.filialeId) {
      throw new BadRequestException('Impossible de partager avec la même filiale')
    }

    const filialeDest = await this.prisma.filiale.findUnique({ where: { id: dto.filialeDestId } })
    if (!filialeDest || !filialeDest.actif) {
      throw new NotFoundException('Filiale destinataire introuvable ou inactive')
    }

    const existing = await this.prisma.partageInterFiliale.findFirst({
      where: {
        documentId: dto.documentId,
        filialeDestId: dto.filialeDestId,
        actif: true,
        statut: { in: ['EN_ATTENTE', 'ACCEPTE'] },
      },
    })
    if (existing) {
      throw new ConflictException('Un partage actif existe déjà pour ce document et cette filiale')
    }

    const expiresAt = dto.dureeJours
      ? new Date(Date.now() + dto.dureeJours * 24 * 60 * 60 * 1000)
      : null

    const partage = await this.prisma.partageInterFiliale.create({
      data: {
        documentId: dto.documentId,
        filialeSrcId: doc.filialeId,
        filialeDestId: dto.filialeDestId,
        autorisePar: user.id,
        expiresAt,
      },
      include: {
        filialeDest: { select: { code: true, nom: true } },
        autorisateur: { select: { prenom: true, nom: true } },
      },
    })

    await this.audit.log({
      action: 'PARTAGE_CREATION',
      userId: user.id,
      filialeId: doc.filialeId,
      documentId: dto.documentId,
      metadata: { filialeDestId: dto.filialeDestId, dureeJours: dto.dureeJours ?? null },
    })

    return partage
  }

  // ── Validation / Refus (filiale dest) ─────────────────────────────────────

  async valider(user: AuthenticatedUser, id: string) {
    const partage = await this.findPartage(id)
    this.assertDest(user, partage.filialeDestId)
    if (partage.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Ce partage ne peut plus être validé')
    }

    const updated = await this.prisma.partageInterFiliale.update({
      where: { id },
      data: { statut: 'ACCEPTE' },
    })

    await this.audit.log({
      action: 'PARTAGE_VALIDATION',
      userId: user.id,
      filialeId: user.filialeId ?? partage.filialeDestId,
      documentId: partage.documentId,
      metadata: { partageId: id },
    })

    return updated
  }

  async refuser(user: AuthenticatedUser, id: string) {
    const partage = await this.findPartage(id)
    this.assertDest(user, partage.filialeDestId)
    if (partage.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Ce partage ne peut plus être refusé')
    }

    const updated = await this.prisma.partageInterFiliale.update({
      where: { id },
      data: { statut: 'REFUSE', actif: false },
    })

    await this.audit.log({
      action: 'PARTAGE_REVOCATION',
      userId: user.id,
      filialeId: user.filialeId ?? partage.filialeDestId,
      documentId: partage.documentId,
      metadata: { partageId: id, raison: 'REFUSE' },
    })

    return updated
  }

  // ── Révocation (filiale src) ───────────────────────────────────────────────

  async revoquer(user: AuthenticatedUser, id: string) {
    const partage = await this.findPartage(id)
    this.assertSrc(user, partage.filialeSrcId)
    if (!partage.actif) {
      throw new BadRequestException('Ce partage est déjà inactif')
    }

    const updated = await this.prisma.partageInterFiliale.update({
      where: { id },
      data: { statut: 'REVOQUE', actif: false },
    })

    await this.audit.log({
      action: 'PARTAGE_REVOCATION',
      userId: user.id,
      filialeId: partage.filialeSrcId,
      documentId: partage.documentId,
      metadata: { partageId: id },
    })

    return updated
  }
}
