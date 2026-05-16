import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class CreateCommentaireDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  contenu: string
}

export class UpdateCommentaireDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  contenu: string
}
