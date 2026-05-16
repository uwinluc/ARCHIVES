import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedUser } from '../auth/auth.types'
import { CreateCategorieDto } from './dto/create-categorie.dto'
import { PartialType } from '@nestjs/mapped-types'

class UpdateCategorieDto extends PartialType(CreateCategorieDto) {}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthenticatedUser) {
    const filialeFilter = {
      OR: [
        { filialeId: null },
        ...(user.filialeId ? [{ filialeId: user.filialeId }] : []),
      ],
    }
    return this.prisma.categorie.findMany({
      where: {
        actif: true,
        parentId: null,
        ...filialeFilter,
      },
      include: {
        children: {
          where: {
            actif: true,
            ...filialeFilter,
          },
          orderBy: { libelle: 'asc' },
        },
      },
      orderBy: { libelle: 'asc' },
    })
  }

  async findOne(id: string) {
    const cat = await this.prisma.categorie.findUnique({ where: { id } })
    if (!cat) throw new NotFoundException('Catégorie introuvable')
    return cat
  }

  async create(user: AuthenticatedUser, dto: CreateCategorieDto) {
    const filialeId = user.role === 'SUPER_ADMIN' ? (dto.filialeId ?? null) : user.filialeId!

    // Prisma cannot use findUnique with a composite key when one field is null
    // (@@unique([code, filialeId]) — Postgres treats NULL as distinct, but Prisma
    // rejects the query entirely). Use findFirst with explicit null-safe conditions.
    const exists = await this.prisma.categorie.findFirst({
      where: {
        code: dto.code.toUpperCase(),
        filialeId: filialeId ?? null,
      },
    })
    if (exists) throw new ConflictException(`Code catégorie déjà utilisé : ${dto.code}`)

    if (dto.parentId) {
      const parent = await this.prisma.categorie.findUnique({ where: { id: dto.parentId } })
      if (!parent) throw new NotFoundException('Catégorie parente introuvable')
      if (parent.parentId) throw new ConflictException('Les sous-catégories ne peuvent pas avoir de sous-catégories')
    }

    return this.prisma.categorie.create({
      data: {
        code: dto.code.toUpperCase(),
        libelle: dto.libelle,
        dureeConservationAns: dto.dureeConservationAns ?? null,
        filialeId,
        parentId: dto.parentId ?? null,
      },
      include: { children: true },
    })
  }

  async update(id: string, dto: UpdateCategorieDto) {
    await this.findOne(id)
    return this.prisma.categorie.update({
      where: { id },
      data: {
        ...(dto.libelle && { libelle: dto.libelle }),
        ...(dto.dureeConservationAns !== undefined && { dureeConservationAns: dto.dureeConservationAns }),
      },
      include: { children: true },
    })
  }

  async deactivate(id: string) {
    await this.findOne(id)
    await this.prisma.categorie.updateMany({ where: { parentId: id }, data: { actif: false } })
    return this.prisma.categorie.update({ where: { id }, data: { actif: false } })
  }
}
