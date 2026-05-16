import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { CommentairesService } from './commentaires.service'
import { CreateCommentaireDto, UpdateCommentaireDto } from './dto/commentaire.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { MinRole } from '../auth/decorators/roles.decorator'
import { AuthenticatedUser } from '../auth/auth.types'

@Controller()
export class CommentairesController {
  constructor(private readonly commentairesService: CommentairesService) {}

  @Get('documents/:documentId/commentaires')
  @MinRole('LECTEUR')
  findByDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.commentairesService.findByDocument(user, documentId)
  }

  @Post('documents/:documentId/commentaires')
  @MinRole('COLLABORATEUR')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() dto: CreateCommentaireDto,
  ) {
    return this.commentairesService.create(user, documentId, dto)
  }

  @Patch('commentaires/:id')
  @MinRole('COLLABORATEUR')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommentaireDto,
  ) {
    return this.commentairesService.update(user, id, dto)
  }

  @Delete('commentaires/:id')
  @MinRole('COLLABORATEUR')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.commentairesService.remove(user, id)
  }
}
