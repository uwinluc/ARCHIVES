import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { StatsResponse } from '@gi/shared-types'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const { data } = await api.get<StatsResponse>('/stats')
      return data
    },
    staleTime: 60_000, // 1 min
  })
}
