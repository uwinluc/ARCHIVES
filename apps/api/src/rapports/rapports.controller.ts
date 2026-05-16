import { Controller, Get, Query, Res } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthenticatedUser } from '../auth/auth.types'
import { RapportsService } from './rapports.service'

@Controller('rapports')
export class RapportsController {
  constructor(private readonly rapports: RapportsService) {}

  @Get('inventaire')
  async downloadInventaire(
    @CurrentUser() user: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ) {
    const today = new Date().toISOString().slice(0, 10)
    const buffer = await this.rapports.generateInventaire(user)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="inventaire-${today}.pdf"`)
      .send(buffer)
  }

  @Get('activite')
  async downloadActivite(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() reply: FastifyReply,
  ) {
    const from = dateFrom ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
    const to = dateTo ?? new Date().toISOString().slice(0, 10)
    const buffer = await this.rapports.generateActivite(user, from, to)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="activite-${from}-${to}.pdf"`)
      .send(buffer)
  }
}
