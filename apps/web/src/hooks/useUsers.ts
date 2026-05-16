import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Role, UserProfile } from '@gi/shared-types'

type CreatableRole = Exclude<Role, 'SUPER_ADMIN'>

interface CreateUserDto {
  email: string
  prenom: string
  nom: string
  filialeId: string
  role: CreatableRole
}

interface UpdateUserDto {
  role?: CreatableRole
  actif?: boolean
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<UserProfile[]>('/users')
      return data
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function useUserMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const create = useMutation({
    mutationFn: (dto: CreateUserDto) => api.post<UserProfile>('/users', dto).then((r) => r.data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      api.patch<UserProfile>(`/users/${id}`, dto).then((r) => r.data),
    onSuccess: invalidate,
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: invalidate,
  })

  return { create, update, deactivate }
}
