import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Document, PaginatedResponse } from '@gi/shared-types'

export interface DocumentFilters {
  page?: number
  limit?: number
  statut?: string[]
  categorieId?: string
  confidentialite?: string
  dateDocumentFrom?: string
  dateDocumentTo?: string
  q?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

async function fetchDocuments(filters: DocumentFilters): Promise<PaginatedResponse<Document>> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.statut?.length) params.set('statut', filters.statut.join(','))
  if (filters.categorieId) params.set('categorieId', filters.categorieId)
  if (filters.confidentialite) params.set('confidentialite', filters.confidentialite)
  if (filters.dateDocumentFrom) params.set('dateDocumentFrom', filters.dateDocumentFrom)
  if (filters.dateDocumentTo) params.set('dateDocumentTo', filters.dateDocumentTo)
  if (filters.sortBy) params.set('sortBy', filters.sortBy)
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)

  const endpoint = filters.q ? `/documents/search?q=${encodeURIComponent(filters.q)}&${params}` : `/documents?${params}`
  const { data } = await api.get<PaginatedResponse<Document>>(endpoint)
  return data
}

async function transitionDocument(id: string, action: string, body?: object) {
  const { data } = await api.post(`/documents/${id}/${action}`, body ?? {})
  return data
}

export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: () => fetchDocuments(filters),
    placeholderData: (prev) => prev,
  })
}

export function useDocumentMutation() {
  const qc = useQueryClient()

  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ['documents'] })
    if (id) {
      qc.invalidateQueries({ queryKey: ['document', id] })
      qc.invalidateQueries({ queryKey: ['document-audit', id] })
    }
  }

  const upload = useMutation({
    mutationFn: (formData: FormData) => api.post('/documents', formData),
    onSuccess: () => invalidate(),
  })

  const soumettre = useMutation({
    mutationFn: (id: string) => transitionDocument(id, 'soumettre'),
    onSuccess: (_, id) => invalidate(id),
  })

  const valider = useMutation({
    mutationFn: (id: string) => transitionDocument(id, 'valider'),
    onSuccess: (_, id) => invalidate(id),
  })

  const rejeter = useMutation({
    mutationFn: ({ id, motif }: { id: string; motif: string }) =>
      transitionDocument(id, 'rejeter', { motif }),
    onSuccess: (_, { id }) => invalidate(id),
  })

  const archiver = useMutation({
    mutationFn: (id: string) => transitionDocument(id, 'archiver'),
    onSuccess: (_, id) => invalidate(id),
  })

  const proposerDestruction = useMutation({
    mutationFn: ({ id, justification }: { id: string; justification: string }) =>
      transitionDocument(id, 'proposer-destruction', { justification }),
    onSuccess: (_, { id }) => invalidate(id),
  })

  const confirmerDestruction = useMutation({
    mutationFn: (id: string) => transitionDocument(id, 'confirmer-destruction'),
    onSuccess: (_, id) => invalidate(id),
  })

  return { upload, soumettre, valider, rejeter, archiver, proposerDestruction, confirmerDestruction }
}

export function useDownloadUrl(id: string | null) {
  return useQuery({
    queryKey: ['document-download', id],
    queryFn: async () => {
      const { data } = await api.get<string>(`/documents/${id}/download`)
      return data
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 min (URL valide 15 min)
  })
}
