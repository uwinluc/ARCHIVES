import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class CreateFilialeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string

  @IsString()
  @IsNotEmpty()
  nom: string

  @IsString()
  @IsNotEmpty()
  pays: string
}
