import { SetMetadata } from '@nestjs/common'
import type { Role } from '@gi/shared-types'

export const ROLES_KEY = 'roles'

// Usage : @MinRole('ARCHIVISTE')
// Autorise le rôle spécifié ET tous les rôles au-dessus dans la hiérarchie.
export const MinRole = (role: Role) => SetMetadata(ROLES_KEY, role)
