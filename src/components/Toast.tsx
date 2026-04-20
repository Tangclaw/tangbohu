'use client'

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { Check } from 'lucide-react'

interface Toast {
 id: string
 message: string
 type: 'success' | 'info' | 'error'
 exiting?: boolean
 icon?: React.ReactNode
}

interface ToastContextType {
 toast: (message: string, type?: 'success' | 'info' | 'error', icon?: React.ReactNode) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
 const ctx = useContext(ToastContext)
 if (!ctx) throw new Error('useToast must be within ToastProvider')
 return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
 const [toasts, setToasts] = useState<Toast[]>([])

 const addToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success', icon?: React.ReactNode) => {
 const id = Math.random().toString(36).slice(2)
 setToasts((prev) => [...prev.slice(-2), { id, message, type, icon }])
 setTimeout(() => {
 setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t))
 setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 200)
 }, 2300)
 }, [])

 return (
 <ToastContext.Provider value={{ toast: addToast }}>
 {children}
 <div role="status" aria-live="polite" className="fixed bottom-16 lg:bottom-6 left-1/2 z-50 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none">
 {toasts.map((t) => (
 <div
 key={t.id}
 className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm shadow-lg transition-all ${
 t.exiting ? 'animate-toast-out' : 'animate-toast-in'
 } ${
 t.type === 'error'
 ? 'bg-red-600 text-white'
 : t.type === 'success'
 ? 'bg-gray-900 text-white'
 : 'bg-gray-800 text-gray-200'
 }`}
 >
 {t.icon || <Check size={16} />}
 <span>{t.message}</span>
 </div>
 ))}
 </div>
 </ToastContext.Provider>
 )
}
