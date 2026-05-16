import { Injectable } from '@nestjs/common'
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability'
import type { AuthenticatedUser } from '../auth.types'

type Actions = 'manage' | 'read' | 'create' | 'update' | 'delete' | 'validate' | 'archive' | 'destroy'
type Subjects = 'Document' | 'User' | 'Filiale' | 'Categorie' | 'Partage' | 'AuditLog' | 'all'

export type AppAbility = MongoAbility<[Actions, Subjects]>

@Injectable()
export class AbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

    switch (user.role) {
      case 'SUPER_ADMIN':
        can('manage', 'all')
        break

      case 'ADMIN_FILIALE':
        can('manage', 'Document')
        can('manage', 'User')
        can('manage', 'Categorie')
        can('read', 'Filiale')
        can('read', 'AuditLog')
        can('validate', 'Document')
        can('archive', 'Document')
        can('destroy', 'Document')
        break

      case 'ARCHIVISTE':
        can('read', 'Document')
        can('create', 'Document')
        can('update', 'Document')
        can('archive', 'Document')
        can('destroy', 'Document')
        can('read', 'AuditLog')
        can('manage', 'Partage')
        break

      case 'MANAGER':
        can('read', 'Document')
        can('create', 'Document')
        can('update', 'Document')
        can('validate', 'Document')
        can('read', 'AuditLog')
        break

      case 'COLLABORATEUR':
        can('read', 'Document')
        can('create', 'Document')
        can('update', 'Document')
        cannot('delete', 'Document')
        break

      case 'LECTEUR':
        can('read', 'Document')
        cannot('create', 'Document')
        cannot('update', 'Document')
        cannot('delete', 'Document')
        break
    }

    return build()
  }
}
