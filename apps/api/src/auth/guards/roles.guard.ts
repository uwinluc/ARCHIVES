import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { hasMinRole } from '../auth.types'
import type { Role } from '@gi/shared-types'
import type { AuthenticatedUser } from '../auth.types'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minRole = this.reflector.getAllAndOverride<Role | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!minRole) return true

    const user: AuthenticatedUser = context.switchToHttp().getRequest().user
    if (!user) return false

    if (!hasMinRole(user.role, minRole)) {
      throw new ForbiddenException(`Rôle minimum requis : ${minRole}`)
    }

    return true
  }
}
