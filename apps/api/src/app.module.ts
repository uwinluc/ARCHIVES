import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './prisma/prisma.module'
import { CommonModule } from './common/common.module'
import { AuthModule } from './auth/auth.module'
import { FilialessModule } from './filiales/filiales.module'
import { UsersModule } from './users/users.module'
import { CategoriesModule } from './categories/categories.module'
import { DocumentsModule } from './documents/documents.module'
import { PartagesModule } from './partages/partages.module'
import { StatsModule } from './stats/stats.module'
import { RapportsModule } from './rapports/rapports.module'
import { NotificationsModule } from './notifications/notifications.module'
import { CommentairesModule } from './commentaires/commentaires.module'

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      { name: 'upload',  ttl: 60_000, limit: 10 },
      { name: 'auth',    ttl: 60_000, limit: 5  },
    ]),

    ScheduleModule.forRoot(),

    PrismaModule,
    CommonModule,
    AuthModule,
    FilialessModule,
    UsersModule,
    CategoriesModule,
    DocumentsModule,
    PartagesModule,
    StatsModule,
    RapportsModule,
    NotificationsModule,
    CommentairesModule,
  ],
})
export class AppModule {}
