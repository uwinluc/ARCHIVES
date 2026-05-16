import { IsNotEmpty, IsString } from 'class-validator'

export class RejeterDto {
  @IsString()
  @IsNotEmpty()
  motif: string
}

export class ProposerDestructionDto {
  @IsString()
  @IsNotEmpty()
  justification: string
}
