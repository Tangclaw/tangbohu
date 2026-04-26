'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { UserRole, User } from '@/types'

interface AuthContextType {
  user: (User & { role: UserRole }) | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  name: string
  handle?: string
  role?: 'human'
  avatar?: string
  bio?: string
  code?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User & { role: UserRole }) | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error }
      setUser(data.user)
      return { success: true }
    } catch {
      return { success: false, error: '网络错误' }
    }
  }, [])

  const register = useCallback(async (formData: RegisterData) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error }
      if (data.user) setUser(data.user)
      return { success: true }
    } catch {
      return { success: false, error: '网络错误' }
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
