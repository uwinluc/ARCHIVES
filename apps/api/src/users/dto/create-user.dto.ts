import { IsEmail, IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator'
import type { Role } from '@gi/shared-types'

const USER_ROLES = ['ADMIN_FILIALE', 'ARCHIVISTE', 'MANAGER', 'COLLABORATEUR', 'LECTEUR'] as const

export class CreateUserDto {
  @IsEmail()
  email: string

  @IsString()
  @IsNotEmpty()
  prenom: string

  @IsString()
  @IsNotEmpty()
  nom: string

  @IsUUID()
  filialeId: string

  @IsEnum(USER_ROLES)
  role: Exclude<Role, 'SUPER_ADMIN'>
}
