import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SupabaseAdminService } from '../common/services/supabase-admin.service'
import { AuthenticatedUser } from '../auth/auth.types'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import type { Role } from '@gi/shared-types'

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  private assertSameFiliale(user: AuthenticatedUser, filialeId: string): void {
    if (user.role !== 'SUPER_ADMIN' && user.filialeId !== filialeId) {
      throw new ForbiddenException('Accès interdit à cette filiale')
    }
  }

  findAll(user: AuthenticatedUser) {
    const where = user.role === 'SUPER_ADMIN' ? {} : { filialeId: user.filialeId! }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true, email: true, prenom: true, nom: true,
        filialeId: true, actif: true, createdAt: true,
        roles: { select: { role: true, filialeId: true } },
      },
      orderBy: { nom: 'asc' },
    })
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const found = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, prenom: true, nom: true,
        filialeId: true, actif: true, createdAt: true,
        roles: { select: { role: true, filialeId: true } },
      },
    })
    if (!found) throw new NotFoundException('Utilisateur introuvable')
    if (found.filialeId) this.assertSameFiliale(user, found.filialeId)
    return found
  }

  async create(user: AuthenticatedUser, dto: CreateUserDto) {
    this.assertSameFiliale(user, dto.filialeId)

    const filiale = await this.prisma.filiale.findUnique({ where: { id: dto.filialeId } })
    if (!filiale) throw new NotFoundException('Filiale introuvable')

    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException(`Email déjà utilisé : ${dto.email}`)

    // Créer l'utilisateur dans Supabase Auth avec ses métadonnées
    const supabaseId = await this.supabaseAdmin.createUser({
      email: dto.email,
      filialeId: dto.filialeId,
      filialeCode: filiale.code,
      role: dto.role as Role,
    })

    // Miroir en base locale
    const created = await this.prisma.user.create({
      data: {
        keycloakId: supabaseId,
        email: dto.email,
        prenom: dto.prenom,
        nom: dto.nom,
        filialeId: dto.filialeId,
        roles: { create: { role: dto.role as Role, filialeId: dto.filialeId } },
      },
      include: { roles: true },
    })

    return created
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id } })
    if (!target) throw new NotFoundException('Utilisateur introuvable')
    if (target.filialeId) this.assertSameFiliale(user, target.filialeId)

    // Mise à jour du rôle dans Supabase Auth si changement
    if (dto.role) {
      const filiale = target.filialeId
        ? await this.prisma.filiale.findUnique({ where: { id: target.filialeId } })
        : null

      await this.supabaseAdmin.updateUserMetadata(target.keycloakId, {
        filialeId: target.filialeId,
        filialeCode: filiale?.code ?? null,
        role: dto.role as Role,
      })

      await this.prisma.userRole.upsert({
        where: { userId_filialeId: { userId: id, filialeId: target.filialeId! } },
        create: { userId: id, role: dto.role as Role, filialeId: target.filialeId },
        update: { role: dto.role as Role },
      })
    }

    // Désactivation / réactivation dans Supabase Auth
    if (dto.actif === false) await this.supabaseAdmin.banUser(target.keycloakId)
    if (dto.actif === true) await this.supabaseAdmin.unbanUser(target.keycloakId)

    return this.prisma.user.update({
      where: { id },
      data: { ...(dto.actif !== undefined && { actif: dto.actif }) },
      select: { id: true, email: true, prenom: true, nom: true, actif: true },
    })
  }

  async deactivate(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { actif: false })
  }
}
