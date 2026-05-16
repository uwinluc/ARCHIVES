import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { DocumentsService } from './documents.service'
import { CreateDocumentDto } from './dto/create-document.dto'
import { UpdateDocumentDto } from './dto/update-document.dto'
import { QueryDocumentDto } from './dto/query-document.dto'
import { RejeterDto, ProposerDestructionDto } from './dto/workflow.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { MinRole } from '../auth/decorators/roles.decorator'
import { AuthenticatedUser } from '../auth/auth.types'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── Liste + recherche ──────────────────────────────────────────────────

  @Get()
  @MinRole('LECTEUR')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryDocumentDto) {
    return this.documentsService.findAll(user, query)
  }

  // Doit être AVANT @Get(':id') pour ne pas être capturé comme paramètre
  @Get('search')
  @MinRole('LECTEUR')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q: string,
    @Query() query: QueryDocumentDto,
  ) {
    return this.documentsService.searchDocuments(user, q ?? '', query)
  }

  @Get('corbeille')
  @MinRole('LECTEUR')
  findCorbeille(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findCorbeille(user)
  }

  @Get(':id')
  @MinRole('LECTEUR')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.findOne(user, id)
  }

  @Get(':id/versions')
  @MinRole('LECTEUR')
  getVersions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.getVersions(user, id)
  }

  @Get(':id/download')
  @MinRole('LECTEUR')
  getDownloadUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.getDownloadUrl(user, id)
  }

  @Get(':id/audit')
  @MinRole('ARCHIVISTE')
  getAuditLog(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.getAuditLog(user, id)
  }

  // ── Création (multipart/form-data) ─────────────────────────────────────

  @Post()
  @MinRole('COLLABORATEUR')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthenticatedUser, @Req() req: FastifyRequest) {
    const parts = req.parts()
    const fields: Record<string, string> = {}
    let uploadedFile: { buffer: Buffer; filename: string; mimetype: string } | null = null

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) {
          chunks.push(chunk as Buffer)
        }
        uploadedFile = {
          buffer: Buffer.concat(chunks),
          filename: part.filename,
          mimetype: part.mimetype,
        }
      } else {
        fields[part.fieldname] = part.value as string
      }
    }

    if (!uploadedFile) throw new BadRequestException('Fichier requis')

    const dto = plainToInstance(CreateDocumentDto, fields)
    const errors = await validate(dto)
    if (errors.length) {
      throw new BadRequestException(errors.map((e) => Object.values(e.constraints ?? {}).join(', ')))
    }

    return this.documentsService.create(user, dto, uploadedFile)
  }

  // ── Nouvelle version (multipart) ──────────────────────────────────────

  @Post(':id/nouvelle-version')
  @MinRole('COLLABORATEUR')
  @HttpCode(HttpStatus.CREATED)
  async nouvelleVersion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Req() req: FastifyRequest) {
    const parts = req.parts()
    let uploadedFile: { buffer: Buffer; filename: string; mimetype: string } | null = null

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) {
          chunks.push(chunk as Buffer)
        }
        uploadedFile = { buffer: Buffer.concat(chunks), filename: part.filename, mimetype: part.mimetype }
      }
    }

    if (!uploadedFile) throw new BadRequestException('Fichier requis')
    return this.documentsService.nouvelleVersion(user, id, uploadedFile)
  }

  // ── Modification métadonnées ───────────────────────────────────────────

  @Patch(':id')
  @MinRole('COLLABORATEUR')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(user, id, dto)
  }

  @Delete(':id')
  @MinRole('COLLABORATEUR')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.remove(user, id)
  }

  @Post(':id/restaurer')
  @MinRole('COLLABORATEUR')
  restaurer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.restaurer(user, id)
  }

  @Delete(':id/purger')
  @MinRole('ADMIN_FILIALE')
  @HttpCode(HttpStatus.NO_CONTENT)
  purger(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.purger(user, id)
  }

  // ── Workflow ───────────────────────────────────────────────────────────

  @Post(':id/soumettre')
  @MinRole('COLLABORATEUR')
  soumettre(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.soumettre(user, id)
  }

  @Post(':id/valider')
  @MinRole('MANAGER')
  valider(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.valider(user, id)
  }

  @Post(':id/rejeter')
  @MinRole('MANAGER')
  rejeter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejeterDto,
  ) {
    return this.documentsService.rejeter(user, id, dto.motif)
  }

  @Post(':id/archiver')
  @MinRole('ARCHIVISTE')
  archiver(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.archiver(user, id)
  }

  @Post(':id/proposer-destruction')
  @MinRole('ARCHIVISTE')
  proposerDestruction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ProposerDestructionDto,
  ) {
    return this.documentsService.proposerDestruction(user, id, dto.justification)
  }

  @Post(':id/confirmer-destruction')
  @MinRole('ADMIN_FILIALE')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmerDestruction(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.confirmerDestruction(user, id)
  }
}
