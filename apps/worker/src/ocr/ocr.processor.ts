import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { createWorker } from 'tesseract.js'
import { createClient } from '@supabase/supabase-js'
import { PrismaService } from '../prisma/prisma.service'
import type { OcrJobData, IndexJobData } from '@gi/shared-types'

@Processor('ocr')
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name)
  private readonly langs: string
  private readonly maxChars: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('indexation') private readonly indexQueue: Queue<IndexJobData>,
  ) {
    super()
    this.langs = config.get('OCR_LANGUAGES', 'fra+eng')
    this.maxChars = config.get<number>('OCR_MAX_CHARS', 50_000)
  }

  async process(job: Job<OcrJobData>): Promise<void> {
    const { documentId, storageKey, filialeCode, mimeType } = job.data
    this.logger.log(`OCR démarré : ${documentId}`)

    try {
      const buffer = await this.downloadFile(filialeCode, storageKey)
      const text = await this.runOcr(buffer, mimeType)

      await this.prisma.document.update({
        where: { id: documentId },
        data: { contenuOcr: text },
      })

      // Réindexer après extraction OCR
      await this.indexQueue.add('upsert', { documentId, action: 'upsert' })
      this.logger.log(`OCR terminé : ${documentId} (${text.length} caractères)`)
    } catch (err) {
      this.logger.error(`OCR échoué pour ${documentId} : ${err}`)
      throw err // BullMQ retentera le job selon la config retry
    }
  }

  private async downloadFile(filialeCode: string, storageKey: string): Promise<Buffer> {
    const supabase = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    )
    const bucket = `${this.config.get('STORAGE_BUCKET_PREFIX', 'gi')}-${filialeCode.toLowerCase()}`

    const { data, error } = await supabase.storage.from(bucket).download(storageKey)
    if (error || !data) throw new Error(`Téléchargement storage échoué : ${error?.message}`)

    return Buffer.from(await data.arrayBuffer())
  }

  private async runOcr(buffer: Buffer, mimeType: string): Promise<string> {
    // Pour les PDF, Tesseract.js traite la première page
    // Pour les images, traitement direct
    const worker = await createWorker(this.langs)
    try {
      const { data } = await worker.recognize(buffer)
      return data.text.slice(0, this.maxChars).trim()
    } finally {
      await worker.terminate()
    }
  }
}
