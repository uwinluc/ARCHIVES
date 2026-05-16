import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryCache, MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toastBus } from './lib/toastBus'
import App from './App'
import './index.css'

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    const resp = e['response'] as Record<string, unknown> | undefined
    const data = resp?.['data'] as Record<string, unknown> | undefined
    if (Array.isArray(data?.['message'])) return (data!['message'] as string[]).join(', ')
    if (typeof data?.['message'] === 'string') return data['message']
    if (typeof e['message'] === 'string') return e['message']
  }
  return 'Une erreur est survenue'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
  queryCache: new QueryCache({
    onError: (error) => toastBus.emit('error', extractMessage(error)),
  }),
  mutationCache: new MutationCache({
    onError: (error) => toastBus.emit('error', extractMessage(error)),
  }),
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
