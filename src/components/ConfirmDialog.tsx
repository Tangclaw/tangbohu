'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type ConfirmTone = 'default' | 'danger' | 'warning'

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmText?: string
  cancelText?: string
  tone?: ConfirmTone
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be within ConfirmProvider')
  return ctx.confirm
}

const toneButton: Record<ConfirmTone, string> = {
  default: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 focus-visible:ring-blue-400/70',
  danger: 'bg-red-600 hover:bg-red-700 shadow-red-500/25 focus-visible:ring-red-400/70',
  warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25 focus-visible:ring-amber-400/70',
}

type DialogState = ConfirmOptions & { open: boolean }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({ open: false, title: '' })
  const resolveRef = useRef<((value: boolean) => void) | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    resolveRef.current?.(false)
    if (typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement as HTMLElement | null
    }
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({ ...options, open: true })
    })
  }, [])

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result)
    resolveRef.current = null
    setState((prev) => ({ ...prev, open: false }))
    const previous = previousFocusRef.current
    if (previous?.isConnected && typeof previous.focus === 'function') {
      requestAnimationFrame(() => previous.focus())
    }
  }, [])

  useEffect(() => {
    if (!state.open) return
    confirmButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [state.open, close])

  const tone = state.tone ?? 'default'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div
          className="animate-fadeIn fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={state.message ? 'confirm-dialog-message' : undefined}
            className="ai-panel animate-rise-in w-full max-w-sm rounded-3xl p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-dialog-title" className="text-lg font-black text-slate-950">
              {state.title}
            </h2>
            {state.message && (
              <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-slate-500">
                {state.message}
              </p>
            )}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => close(false)}
                className="ai-interactive rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                {state.cancelText ?? '取消'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => close(true)}
                className={`ai-interactive rounded-full px-5 py-2 text-sm font-black text-white shadow-lg transition focus-visible:ring-2 focus-visible:ring-offset-2 ${toneButton[tone]}`}
              >
                {state.confirmText ?? '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
