import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { MeilisearchService } from './meilisearch.service'
import { PrismaService } from '../prisma/prisma.service'
import type { IndexJobData } from '@gi/shared-types'

@Processor('indexation')
export class IndexationProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexationProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly meili: MeilisearchService,
  ) {
    super()
  }

  async process(job: Job<IndexJobData>): Promise<void> {
    const { documentId, action } = job.data

    if (action === 'delete') {
      await this.meili.delete(documentId)
      this.logger.log(`Supprimé de l'index : ${documentId}`)
      return
    }

    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { currentVersion: { select: { mimeType: true } } },
    })

    if (!doc || doc.statut === 'DETRUIT') {
      await this.meili.delete(documentId)
      return
    }

    // Les documents CONFIDENTIEL et SECRET n'ont pas leur contenu OCR indexé
    const contenuOcr =
      doc.confidentialite === 'CONFIDENTIEL' || doc.confidentialite === 'SECRET'
        ? null
        : doc.contenuOcr

    await this.meili.upsert({
      id: doc.id,
      titre: doc.titre,
      description: doc.description,
      tags: doc.tags,
      contenuOcr,
      filialeId: doc.filialeId,
      categorieId: doc.categorieId,
      statut: doc.statut,
      confidentialite: doc.confidentialite,
      auteurId: doc.auteurId,
      typeMime: doc.currentVersion?.mimeType ?? null,
      dateDocument: doc.dateDocument.getTime(),
      dateDepot: doc.createdAt.getTime(),
      dateExpiration: doc.dateExpiration?.getTime() ?? null,
    })

    this.logger.log(`Indexé : ${documentId} (${doc.titre})`)
  }
}
