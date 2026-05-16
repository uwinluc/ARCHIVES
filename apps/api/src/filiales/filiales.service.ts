import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFilialeDto } from './dto/create-filiale.dto'
import { PartialType } from '@nestjs/mapped-types'

class UpdateFilialeDto extends PartialType(CreateFilialeDto) {}

@Injectable()
export class FilialessService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.filiale.findMany({ orderBy: { nom: 'asc' } })
  }

  async findOne(id: string) {
    const filiale = await this.prisma.filiale.findUnique({ where: { id } })
    if (!filiale) throw new NotFoundException('Filiale introuvable')
    return filiale
  }

  async create(dto: CreateFilialeDto) {
    const exists = await this.prisma.filiale.findUnique({ where: { code: dto.code } })
    if (exists) throw new ConflictException(`Code filiale déjà utilisé : ${dto.code}`)

    return this.prisma.filiale.create({
      data: { code: dto.code.toUpperCase(), nom: dto.nom, pays: dto.pays },
    })
  }

  async update(id: string, dto: UpdateFilialeDto) {
    await this.findOne(id)
    return this.prisma.filiale.update({ where: { id }, data: dto })
  }

  async deactivate(id: string) {
    await this.findOne(id)
    return this.prisma.filiale.update({ where: { id }, data: { actif: false } })
  }
}
