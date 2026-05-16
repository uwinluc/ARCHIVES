import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import MeiliSearch from 'meilisearch'

interface MeiliDocument {
  id: string
  titre: string
  description: string | null
  tags: string[]
  contenuOcr: string | null
  filialeId: string
  categorieId: string
  statut: string
  confidentialite: string
  auteurId: string
  typeMime: string | null
  dateDocument: number    // timestamp ms
  dateDepot: number       // timestamp ms
  dateExpiration: number | null
}

@Injectable()
export class MeilisearchService implements OnModuleInit {
  private readonly client: MeiliSearch
  private readonly logger = new Logger(MeilisearchService.name)
  static readonly INDEX = 'documents'

  constructor(private readonly config: ConfigService) {
    this.client = new MeiliSearch({
      host: config.getOrThrow('MEILI_HOST'),
      apiKey: config.getOrThrow('MEILI_MASTER_KEY'),
    })
  }

  async onModuleInit() {
    try {
      await this.client.index(MeilisearchService.INDEX).updateSettings({
        searchableAttributes: ['titre', 'description', 'tags', 'contenuOcr'],
        filterableAttributes: [
          'filialeId', 'categorieId', 'statut', 'confidentialite',
          'auteurId', 'typeMime', 'dateDocument', 'dateExpiration',
        ],
        sortableAttributes: ['dateDocument', 'dateDepot', 'titre'],
        // contenuOcr et storageKey jamais exposés dans les résultats
        displayedAttributes: [
          'id', 'titre', 'description', 'statut', 'filialeId',
          'categorieId', 'tags', 'dateDocument', 'auteurId', 'typeMime',
        ],
      })
      this.logger.log('Index Meilisearch configuré')
    } catch (err) {
      this.logger.warn(`Meilisearch non disponible au démarrage : ${err}`)
    }
  }

  async upsert(doc: MeiliDocument): Promise<void> {
    await this.client.index(MeilisearchService.INDEX).addDocuments([doc])
  }

  async delete(id: string): Promise<void> {
    await this.client.index(MeilisearchService.INDEX).deleteDocument(id)
  }
}
