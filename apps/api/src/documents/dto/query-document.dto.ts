import { Transform, Type } from 'class-transformer'
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'
import { Confidentialite, StatutDocument } from '@prisma/client'

export class QueryDocumentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(StatutDocument, { each: true })
  statut?: StatutDocument[]

  @IsOptional()
  @IsUUID()
  categorieId?: string

  @IsOptional()
  @IsEnum(Confidentialite)
  confidentialite?: Confidentialite

  @IsOptional()
  @IsUUID()
  auteurId?: string

  @IsOptional()
  @IsDateString()
  dateDocumentFrom?: string

  @IsOptional()
  @IsDateString()
  dateDocumentTo?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsEnum(['dateDocument', 'createdAt', 'titre'])
  sortBy?: 'dateDocument' | 'createdAt' | 'titre' = 'createdAt'

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}
