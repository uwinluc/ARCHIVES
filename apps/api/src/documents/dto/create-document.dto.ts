import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'
import { Transform } from 'class-transformer'
import { Confidentialite } from '@prisma/client'

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  titre: string

  @IsUUID()
  categorieId: string

  @IsDateString()
  dateDocument: string

  @IsEnum(Confidentialite)
  confidentialite: Confidentialite

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((t: string) => t.trim()) : value))
  tags?: string[]

  @IsOptional()
  @IsString()
  reference?: string

  @IsOptional()
  @IsString()
  auteurExterne?: string
}
