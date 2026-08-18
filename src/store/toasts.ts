import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

const DURATION_MS = 3200

let sequence = 0

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    // Collapse repeats: dragging an illegal connection twice should not stack.
    if (get().toasts.some((toast) => toast.message === message)) return
    sequence += 1
    const id = `toast-${sequence}`
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), DURATION_MS)
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

export const toast = {
  info: (message: string) => useToasts.getState().push(message, 'info'),
  success: (message: string) => useToasts.getState().push(message, 'success'),
  error: (message: string) => useToasts.getState().push(message, 'error'),
}
