import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { FilialessService } from './filiales.service'
import { CreateFilialeDto } from './dto/create-filiale.dto'
import { MinRole } from '../auth/decorators/roles.decorator'

@Controller('filiales')
@MinRole('SUPER_ADMIN')
export class FilialessController {
  constructor(private readonly service: FilialessService) {}

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateFilialeDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateFilialeDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id)
  }
}
