type ToastType = 'success' | 'error' | 'info'
type Handler = (type: ToastType, msg: string) => void

let _handler: Handler | null = null

export const toastBus = {
  subscribe: (h: Handler) => { _handler = h },
  unsubscribe: () => { _handler = null },
  emit: (type: ToastType, msg: string) => _handler?.(type, msg),
}
