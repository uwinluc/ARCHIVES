import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Filiale } from '@gi/shared-types'

interface CreateFilialeDto {
  code: string
  nom: string
  pays: string
}

export function useFiliales() {
  return useQuery({
    queryKey: ['filiales'],
    queryFn: async () => {
      const { data } = await api.get<Filiale[]>('/filiales')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useFilialeMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['filiales'] })

  const create = useMutation({
    mutationFn: (dto: CreateFilialeDto) => api.post<Filiale>('/filiales', dto).then((r) => r.data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateFilialeDto> }) =>
      api.patch<Filiale>(`/filiales/${id}`, dto).then((r) => r.data),
    onSuccess: invalidate,
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/filiales/${id}`),
    onSuccess: invalidate,
  })

  return { create, update, deactivate }
}
