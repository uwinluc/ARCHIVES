import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Role } from '@gi/shared-types'

@Injectable()
export class SupabaseAdminService {
  private readonly client: SupabaseClient

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      config.getOrThrow('SUPABASE_URL'),
      config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  }

  async createUser(params: {
    email: string
    filialeId: string | null
    filialeCode: string | null
    role: Role
  }): Promise<string> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: params.email,
      email_confirm: false,
      app_metadata: {
        filiale_id: params.filialeId,
        filiale_code: params.filialeCode,
        role: params.role,
      },
    })
    if (error || !data.user) {
      throw new InternalServerErrorException(`Création compte Auth : ${error?.message}`)
    }
    return data.user.id
  }

  async updateUserMetadata(supabaseId: string, params: {
    filialeId: string | null
    filialeCode: string | null
    role: Role
  }): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(supabaseId, {
      app_metadata: {
        filiale_id: params.filialeId,
        filiale_code: params.filialeCode,
        role: params.role,
      },
    })
    if (error) throw new InternalServerErrorException(`Mise à jour Auth : ${error.message}`)
  }

  async banUser(supabaseId: string): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(supabaseId, {
      ban_duration: '876000h', // ~100 ans = désactivation permanente
    })
    if (error) throw new InternalServerErrorException(`Désactivation Auth : ${error.message}`)
  }

  async unbanUser(supabaseId: string): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(supabaseId, {
      ban_duration: 'none',
    })
    if (error) throw new InternalServerErrorException(`Réactivation Auth : ${error.message}`)
  }
}
