import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateCategorieDto } from './dto/create-categorie.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { MinRole } from '../auth/decorators/roles.decorator'
import { AuthenticatedUser } from '../auth/auth.types'

@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @MinRole('LECTEUR')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user)
  }

  @Post()
  @MinRole('ADMIN_FILIALE')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategorieDto) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  @MinRole('ADMIN_FILIALE')
  update(@Param('id') id: string, @Body() dto: CreateCategorieDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @MinRole('ADMIN_FILIALE')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id)
  }
}
