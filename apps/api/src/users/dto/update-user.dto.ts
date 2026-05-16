import { IsBoolean, IsEnum, IsOptional } from 'class-validator'
import type { Role } from '@gi/shared-types'

const USER_ROLES = ['ADMIN_FILIALE', 'ARCHIVISTE', 'MANAGER', 'COLLABORATEUR', 'LECTEUR'] as const

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: Exclude<Role, 'SUPER_ADMIN'>

  @IsOptional()
  @IsBoolean()
  actif?: boolean
}
