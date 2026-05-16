import { Injectable } from '@nestjs/common'
import { Prisma, Confidentialite, StatutDocument } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export interface SearchFilters {
  statut?: StatutDocument[]
  confidentialite?: Confidentialite
  categorieId?: string
}

export interface SearchResult {
  ids: string[]
  total: number
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    q: string,
    filialeId: string | null,
    filters: SearchFilters,
    page: number,
    limit: number,
  ): Promise<SearchResult> {
    const where: Prisma.DocumentWhereInput = {
      ...(filialeId && { filialeId }),
      statut: filters.statut?.length ? { in: filters.statut } : { not: 'DETRUIT' },
      ...(filters.confidentialite && { confidentialite: filters.confidentialite }),
      ...(filters.categorieId && { categorieId: filters.categorieId }),
      OR: [
        { titre: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { contenuOcr: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { auteurExterne: { contains: q, mode: 'insensitive' } },
      ],
    }

    const [docs, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ])

    return { ids: docs.map((d: { id: string }) => d.id), total }
  }
}
