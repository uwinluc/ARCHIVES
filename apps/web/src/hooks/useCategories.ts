import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Categorie } from '@gi/shared-types'

interface CreateCategorieDto {
  code: string
  libelle: string
  dureeConservationAns?: number
  parentId?: string
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<Categorie[]>('/categories')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCategorieMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories'] })

  const create = useMutation({
    mutationFn: (dto: CreateCategorieDto) =>
      api.post<Categorie>('/categories', dto).then((r) => r.data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateCategorieDto> }) =>
      api.patch<Categorie>(`/categories/${id}`, dto).then((r) => r.data),
    onSuccess: invalidate,
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: invalidate,
  })

  return { create, update, deactivate }
}
