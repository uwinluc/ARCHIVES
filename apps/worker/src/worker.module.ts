import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { OcrModule } from './ocr/ocr.module'
import { IndexationModule } from './indexation/indexation.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.getOrThrow('REDIS_PASSWORD'),
        },
      }),
    }),

    OcrModule,
    IndexationModule,
  ],
})
export class WorkerModule {}
