import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { AuthenticatedUser } from '../auth.types'

/**
 * Vérifie que l'utilisateur appartient à la filiale demandée.
 * À utiliser sur les endpoints qui exposent un `filialeId` en param ou query.
 * Pour les accès par ID de ressource, la vérification se fait dans le service.
 *
 * SUPER_ADMIN est toujours autorisé.
 */
@Injectable()
export class FilialeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user: AuthenticatedUser = request.user

    if (user.role === 'SUPER_ADMIN') return true

    // filialeId peut venir des params, query ou body
    const requestedFilialeId: string | undefined =
      request.params?.filialeId ??
      request.query?.filialeId ??
      request.body?.filialeId

    if (!requestedFilialeId) return true // pas de filiale dans la requête, le service gérera

    if (user.filialeId !== requestedFilialeId) {
      throw new ForbiddenException('Accès interdit à cette filiale')
    }

    return true
  }
}
