import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCategorieDto {
  @IsString()
  @IsNotEmpty()
  code: string

  @IsString()
  @IsNotEmpty()
  libelle: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dureeConservationAns?: number

  // null = catégorie globale groupe (SUPER_ADMIN uniquement)
  @IsOptional()
  @IsUUID()
  filialeId?: string

  @IsOptional()
  @IsUUID()
  parentId?: string
}
