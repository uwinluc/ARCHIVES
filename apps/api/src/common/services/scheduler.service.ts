import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { EmailService } from './email.service'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // Chaque jour à 2h00 : transfère automatiquement les documents ARCHIVE expirés vers A_DETRUIRE
  @Cron('0 2 * * *', { name: 'expiration-auto' })
  async transitionExpires(): Promise<void> {
    const now = new Date()

    const docs = await this.prisma.document.findMany({
      where: { statut: 'ARCHIVE', dateExpiration: { lt: now } },
      select: { id: true, titre: true, filialeId: true },
    })

    if (!docs.length) return

    // Utilise le premier SUPER_ADMIN comme auteur système des logs d'audit
    const sys = await this.prisma.user.findFirst({
      where: { roles: { some: { role: 'SUPER_ADMIN' } } },
      select: { id: true },
    })

    for (const doc of docs) {
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { statut: 'A_DETRUIRE' },
      })

      if (sys) {
        await this.prisma.auditLog.create({
          data: {
            action: 'PROPOSITION_DESTRUCTION',
            documentId: doc.id,
            userId: sys.id,
            filialeId: doc.filialeId,
            metadata: {
              source: 'cron_expiration',
              raison: 'Durée de conservation légale dépassée',
            },
          },
        })
      }
    }

    this.logger.log(`Cron expiration: ${docs.length} document(s) → A_DETRUIRE`)
  }

  // Chaque jour à 2h30 : envoie des notifications pour les docs expirant dans 90, 30 ou 7 jours
  @Cron('30 2 * * *', { name: 'near-expiry-notify' })
  async notifierExpirationProche(): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let total = 0

    for (const joursRestants of [90, 30, 7]) {
      const start = new Date(today)
      start.setDate(start.getDate() + joursRestants)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)

      const docs = await this.prisma.document.findMany({
        where: {
          statut: { in: ['VALIDE', 'ARCHIVE'] },
          dateExpiration: { gte: start, lt: end },
        },
        include: { auteur: { select: { email: true } } },
      })

      for (const doc of docs) {
        await this.email.notifierExpirationProche(
          doc.titre,
          doc.dateExpiration!,
          doc.auteur.email,
          doc.filialeId,
          joursRestants,
        )
        total++
      }
    }

    if (total > 0) {
      this.logger.log(`Cron near-expiry: ${total} notification(s) envoyée(s)`)
    }
  }
}
