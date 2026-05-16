import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { PartageDetail } from '@gi/shared-types'

interface CreatePartageDto {
  documentId: string
  filialeDestId: string
  dureeJours?: number
}

export function usePartagesDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: ['partages-document', documentId],
    queryFn: async () => {
      const { data } = await api.get<PartageDetail[]>(`/partages?documentId=${documentId}`)
      return data
    },
    enabled: !!documentId,
  })
}

export function usePartagesEmis() {
  return useQuery({
    queryKey: ['partages-emis'],
    queryFn: async () => {
      const { data } = await api.get<PartageDetail[]>('/partages/emis')
      return data
    },
  })
}

export function usePartagesRecus() {
  return useQuery({
    queryKey: ['partages-recus'],
    queryFn: async () => {
      const { data } = await api.get<PartageDetail[]>('/partages/recus')
      return data
    },
  })
}

export function usePartageMutations(documentId?: string) {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partages-emis'] })
    qc.invalidateQueries({ queryKey: ['partages-recus'] })
    if (documentId) qc.invalidateQueries({ queryKey: ['partages-document', documentId] })
  }

  const creer = useMutation({
    mutationFn: (dto: CreatePartageDto) =>
      api.post<PartageDetail>('/partages', dto).then((r) => r.data),
    onSuccess: invalidate,
  })

  const valider = useMutation({
    mutationFn: (id: string) => api.post(`/partages/${id}/valider`),
    onSuccess: invalidate,
  })

  const refuser = useMutation({
    mutationFn: (id: string) => api.post(`/partages/${id}/refuser`),
    onSuccess: invalidate,
  })

  const revoquer = useMutation({
    mutationFn: (id: string) => api.delete(`/partages/${id}`),
    onSuccess: invalidate,
  })

  return { creer, valider, refuser, revoquer }
}
