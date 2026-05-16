import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedUser } from '../auth/auth.types'

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(user: AuthenticatedUser) {
    const filialeFilter =
      user.role === 'SUPER_ADMIN' ? {} : { filialeId: user.filialeId! }

    const now = new Date()
    const in90 = new Date(now)
    in90.setDate(in90.getDate() + 90)

    const [byStatut, expirantIn90j, activiteRecente] = await Promise.all([
      this.prisma.document.groupBy({
        by: ['statut'],
        where: filialeFilter,
        _count: { id: true },
      }),
      this.prisma.document.count({
        where: {
          ...filialeFilter,
          statut: { in: ['VALIDE', 'ARCHIVE'] },
          dateExpiration: { gte: now, lte: in90 },
        },
      }),
      this.prisma.auditLog.findMany({
        where: filialeFilter,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          documentId: true,
          createdAt: true,
          user: { select: { prenom: true, nom: true } },
          document: { select: { titre: true } },
        },
      }),
    ])

    const parStatut: Record<string, number> = {}
    let totalDocuments = 0
    for (const row of byStatut) {
      parStatut[row.statut] = row._count.id
      totalDocuments += row._count.id
    }

    const global = {
      totalDocuments,
      parStatut,
      aDetruire: parStatut['A_DETRUIRE'] ?? 0,
      expirantIn90j,
    }

    let parFiliale: unknown[] = []

    if (user.role === 'SUPER_ADMIN') {
      const [filiales, byFilialeStatut, expirantByFiliale] = await Promise.all([
        this.prisma.filiale.findMany({ where: { actif: true }, orderBy: { code: 'asc' } }),
        this.prisma.document.groupBy({ by: ['filialeId', 'statut'], _count: { id: true } }),
        this.prisma.document.groupBy({
          by: ['filialeId'],
          where: {
            statut: { in: ['VALIDE', 'ARCHIVE'] },
            dateExpiration: { gte: now, lte: in90 },
          },
          _count: { id: true },
        }),
      ])

      const expirantMap = new Map<string, number>()
      for (const row of expirantByFiliale) {
        expirantMap.set(row.filialeId, row._count.id)
      }

      const filialeStatsMap = new Map<string, Record<string, number>>()
      for (const row of byFilialeStatut) {
        if (!filialeStatsMap.has(row.filialeId)) {
          filialeStatsMap.set(row.filialeId, {})
        }
        filialeStatsMap.get(row.filialeId)![row.statut] = row._count.id
      }

      parFiliale = filiales.map((f: any) => {
        const ps = filialeStatsMap.get(f.id) ?? {}
        const total = Object.values(ps).reduce((a, b) => a + b, 0)
        return {
          filiale: { id: f.id, code: f.code, nom: f.nom, pays: f.pays },
          totalDocuments: total,
          parStatut: ps,
          aDetruire: ps['A_DETRUIRE'] ?? 0,
          expirantIn90j: expirantMap.get(f.id) ?? 0,
        }
      })
    }

    return { global, parFiliale, activiteRecente }
  }
}
