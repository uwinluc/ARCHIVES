import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { OcrProcessor } from './ocr.processor'
import { PrismaService } from '../prisma/prisma.service'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'ocr' },
      { name: 'indexation' }, // pour enqueuer après OCR
    ),
  ],
  providers: [OcrProcessor, PrismaService],
})
export class OcrModule {}
