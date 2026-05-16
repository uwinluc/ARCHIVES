import type { Role } from '@gi/shared-types'

export interface AuthenticatedUser {
  id: string
  email: string
  filialeId: string | null  // null = SUPER_ADMIN
  filialeCode: string | null
  role: Role
}

// Hiérarchie des rôles — plus le chiffre est élevé, plus le rôle est puissant.
export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN:    100,
  ADMIN_FILIALE:   80,
  ARCHIVISTE:      60,
  MANAGER:         40,
  COLLABORATEUR:   20,
  LECTEUR:         10,
}

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}
