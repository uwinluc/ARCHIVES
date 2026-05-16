import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { IndexationProcessor } from './indexation.processor'
import { MeilisearchService } from './meilisearch.service'
import { PrismaService } from '../prisma/prisma.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'indexation' })],
  providers: [IndexationProcessor, MeilisearchService, PrismaService],
})
export class IndexationModule {}
