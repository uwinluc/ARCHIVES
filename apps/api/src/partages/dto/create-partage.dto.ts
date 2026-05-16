import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreatePartageDto {
  @IsUUID()
  documentId: string

  @IsUUID()
  filialeDestId: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dureeJours?: number // null = accès permanent
}
