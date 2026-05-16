import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { extname } from 'path'

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient
  private readonly bucketPrefix: string

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.getOrThrow('SUPABASE_URL'),
      config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    )
    this.bucketPrefix = config.get('STORAGE_BUCKET_PREFIX', 'gi')
  }

  bucketName(filialeCode: string): string {
    return `${this.bucketPrefix}-${filialeCode.toLowerCase()}`
  }

  buildStorageKey(filename: string): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const ext = extname(filename) || '.bin'
    return `${year}/${month}/${randomUUID()}${ext}`
  }

  async upload(
    bucket: string,
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(key, buffer, { contentType: mimeType, upsert: false })

    if (error) {
      throw new InternalServerErrorException(`Échec du stockage : ${error.message}`)
    }
  }

  async getSignedUrl(bucket: string, key: string, expiresInSeconds = 900): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSeconds)

    if (error || !data) {
      throw new InternalServerErrorException('Impossible de générer le lien de téléchargement')
    }
    return data.signedUrl
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.supabase.storage.from(bucket).remove([key])
  }

  async generateThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
    if (!mimeType.startsWith('image/')) return null
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharp = require('sharp')
      return await sharp(buffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
    } catch {
      return null
    }
  }
}
