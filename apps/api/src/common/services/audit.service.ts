import { Injectable } from '@nestjs/common'
import { ActionAudit } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

interface LogParams {
  action: ActionAudit
  userId: string
  filialeId: string
  documentId?: string
  metadata?: Record<string, unknown>
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        filialeId: params.filialeId,
        documentId: params.documentId,
        // JSON.parse/stringify produit `any`, compatible avec le champ Json de Prisma
        metadata: JSON.parse(JSON.stringify(params.metadata ?? {})),
      },
    })
  }
}
