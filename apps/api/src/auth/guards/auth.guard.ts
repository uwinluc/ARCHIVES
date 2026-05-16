import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import type { AuthenticatedUser } from '../auth.types'

interface SupabaseJwtPayload {
  sub: string
  email: string
  iss?: string
  exp?: number
  app_metadata?: {
    filiale_id?: string | null
    filiale_code?: string | null
    role?: string
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)

    if (!token) throw new UnauthorizedException('Token manquant')

    try {
      const decoded = this.jwtService.decode(token, { complete: true }) as any
      if (!decoded) throw new Error('Token non décodable')

      const header = decoded.header
      const payload = decoded.payload as SupabaseJwtPayload
      console.log('[AuthGuard alg]', header?.alg, '| iss:', payload?.iss, '| role:', payload?.app_metadata?.role)

      // Vérification expiration
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) throw new Error('Token expiré')

      // Vérification issuer Supabase
      if (!payload.iss?.includes('supabase')) throw new Error('Issuer invalide')

      const meta = payload.app_metadata ?? {}
      if (!meta.role) throw new UnauthorizedException('Rôle non défini sur ce compte')

      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        filialeId: meta.filiale_id ?? null,
        filialeCode: meta.filiale_code ?? null,
        role: meta.role as AuthenticatedUser['role'],
      }

      request.user = user
      return true
    } catch (err) {
      console.error('[AuthGuard]', err instanceof Error ? err.message : err)
      throw new UnauthorizedException('Token invalide ou expiré')
    }
  }

  private extractToken(request: { headers: Record<string, string> }): string | null {
    const auth = request.headers['authorization'] ?? ''
    if (!auth.startsWith('Bearer ')) return null
    return auth.slice(7)
  }
}
