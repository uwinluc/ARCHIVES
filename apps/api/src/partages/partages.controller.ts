import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { PartagesService } from './partages.service'
import { CreatePartageDto } from './dto/create-partage.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { MinRole } from '../auth/decorators/roles.decorator'
import { AuthenticatedUser } from '../auth/auth.types'

@Controller('partages')
export class PartagesController {
  constructor(private readonly service: PartagesService) {}

  @Get('emis')
  @MinRole('ARCHIVISTE')
  findEmis(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findEmis(user)
  }

  @Get('recus')
  @MinRole('LECTEUR')
  findRecus(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findRecus(user)
  }

  // Partages d'un document spécifique (visible depuis la page détail)
  @Get()
  @MinRole('ARCHIVISTE')
  findByDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Query('documentId') documentId: string,
  ) {
    return this.service.findByDocument(user, documentId)
  }

  @Post()
  @MinRole('ARCHIVISTE')
  @HttpCode(HttpStatus.CREATED)
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePartageDto) {
    return this.service.creer(user, dto)
  }

  @Post(':id/valider')
  @MinRole('ADMIN_FILIALE')
  valider(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.valider(user, id)
  }

  @Post(':id/refuser')
  @MinRole('ADMIN_FILIALE')
  refuser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.refuser(user, id)
  }

  @Delete(':id')
  @MinRole('ARCHIVISTE')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoquer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.revoquer(user, id)
  }
}
