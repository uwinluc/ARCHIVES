import { Controller, Get } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthenticatedUser } from '../auth/auth.types'
import { StatsService } from './stats.service'

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.getStats(user)
  }
}
