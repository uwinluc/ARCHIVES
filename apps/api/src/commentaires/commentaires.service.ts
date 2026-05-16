import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedUser } from '../auth/auth.types'
import { CreateCommentaireDto, UpdateCommentaireDto } from './dto/commentaire.dto'

@Injectable()
export class CommentairesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDocument(user: AuthenticatedUser, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { filialeId: true },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    if (user.role !== 'SUPER_ADMIN' && user.filialeId !== doc.filialeId) {
      throw new ForbiddenException('Accès interdit')
    }

    return this.prisma.commentaire.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    })
  }

  async create(user: AuthenticatedUser, documentId: string, dto: CreateCommentaireDto) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { filialeId: true },
    })
    if (!doc) throw new NotFoundException('Document introuvable')
    if (user.role !== 'SUPER_ADMIN' && user.filialeId !== doc.filialeId) {
      throw new ForbiddenException('Accès interdit')
    }

    return this.prisma.commentaire.create({
      data: {
        documentId,
        auteurId: user.id,
        contenu: dto.contenu,
      },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    })
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateCommentaireDto) {
    const comment = await this.prisma.commentaire.findUnique({ where: { id } })
    if (!comment) throw new NotFoundException('Commentaire introuvable')
    if (comment.auteurId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException("Seul l'auteur peut modifier ce commentaire")
    }

    return this.prisma.commentaire.update({
      where: { id },
      data: { contenu: dto.contenu },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    })
  }

  async remove(user: AuthenticatedUser, id: string) {
    const comment = await this.prisma.commentaire.findUnique({ where: { id } })
    if (!comment) throw new NotFoundException('Commentaire introuvable')
    const canDelete =
      comment.auteurId === user.id ||
      user.role === 'ADMIN_FILIALE' ||
      user.role === 'SUPER_ADMIN'
    if (!canDelete) throw new ForbiddenException('Accès interdit')

    await this.prisma.commentaire.delete({ where: { id } })
  }
}
