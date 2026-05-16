import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Document, DocumentVersion } from '@gi/shared-types'

export interface DocumentDetail extends Document {
  categorie: { id: string; code: string; libelle: string }
  auteur: { id: string; prenom: string; nom: string; email: string }
}

export interface AuditEntry {
  id: string
  action: string
  createdAt: string
  metadata: Record<string, unknown>
  user: { id: string; prenom: string; nom: string }
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const { data } = await api.get<DocumentDetail>(`/documents/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useDocumentVersions(id: string | undefined) {
  return useQuery({
    queryKey: ['document-versions', id],
    queryFn: async () => {
      const { data } = await api.get<DocumentVersion[]>(`/documents/${id}/versions`)
      return data
    },
    enabled: !!id,
  })
}

export function useDocumentAudit(id: string | undefined, enabled = false) {
  return useQuery({
    queryKey: ['document-audit', id],
    queryFn: async () => {
      const { data } = await api.get<AuditEntry[]>(`/documents/${id}/audit`)
      return data
    },
    enabled: !!id && enabled,
  })
}
