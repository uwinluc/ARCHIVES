import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './AuthContext'

interface Notification {
  id: string
  type: string
  message: string
  documentId?: string
  documentTitre?: string
  at: number
}

interface NotificationsContextValue {
  notifications: Notification[]
  dismiss: (id: string) => void
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  dismiss: () => {},
})

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const TYPE_ICON: Record<string, string> = {
  document_uploaded:  '📤',
  document_validated: '✅',
  document_rejected:  '❌',
  document_shared:    '🔗',
  document_archived:  '📦',
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const socketRef = useRef<Socket | null>(null)

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  useEffect(() => {
    if (!profile) return

    const socket = io(`${API_URL}/notifications`, {
      query: { filialeId: profile.filialeId ?? '' },
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.on('notification', (payload: Omit<Notification, 'id' | 'at'>) => {
      const notification: Notification = {
        ...payload,
        id: crypto.randomUUID(),
        at: Date.now(),
      }
      setNotifications((prev) => [...prev.slice(-4), notification])
      setTimeout(() => dismiss(notification.id), 6000)
    })

    return () => { socket.disconnect() }
  }, [profile, dismiss])

  return (
    <NotificationsContext.Provider value={{ notifications, dismiss }}>
      {children}
      <NotificationToasts notifications={notifications} onDismiss={dismiss} />
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}

function NotificationToasts({
  notifications,
  onDismiss,
}: {
  notifications: Notification[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.88 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="pointer-events-auto bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 max-w-xs flex items-start gap-3"
          >
            <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 leading-snug">{n.message}</p>
              {n.documentTitre && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{n.documentTitre}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(n.id)}
              className="text-slate-300 hover:text-slate-500 text-sm leading-none shrink-0 -mt-0.5"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
