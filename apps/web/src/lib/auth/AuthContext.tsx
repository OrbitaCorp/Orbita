import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { currentSlug } from '@/lib/tenant'
import { AuthError, bffFetch, tokenStore, tryRefresh } from './authClient'

// ─── Tipos del usuario autenticado ──────────────────────────────────────────
// El shape lo define el backend (login / GET /auth/me). Ver CONTRATO_API.md.

export interface Business {
  id: string
  name: string
  subdomain: string
  mode: string
}

export type AuthUser =
  | {
      type: 'member'
      member: { id: string; name: string; email: string; status?: string }
      role: string
      permissions: string[]
      business: Business
    }
  | {
      type: 'customer'
      customer: { id: string; firstName: string; lastName: string | null; email: string | null }
      business: Business
    }
  | {
      // Super admin de plataforma: identidad cross-tenant, sin `business`.
      type: 'platform_admin'
      admin: { id: string; name: string; email: string; role: string }
    }

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface RegisterPayload {
  firstName: string
  lastName?: string
  email: string
  phone?: string
  password: string
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<AuthUser>
  register: (payload: RegisterPayload) => Promise<{ message: string }>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<{ userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN' }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const slug = currentSlug()
  if (slug) headers['X-Business-Slug'] = slug
  return headers
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  // Bootstrap: en cada carga completa intentamos recuperar la sesión desde la
  // cookie httpOnly de refresh. Esto también resuelve el handoff entre
  // subdominios (dueño que aterriza en {slug}.orbita.local/panel sin token en
  // memoria): la cookie está compartida en .orbita.local, se refresca acá, y
  // /auth/me confirma que el token es válido PARA ESTE tenant (si no, 401 →
  // anónimo, preservando el aislamiento).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const refreshed = await tryRefresh()
      if (!refreshed) {
        if (!cancelled) {
          setUser(null)
          setStatus('anonymous')
        }
        return
      }
      const res = await bffFetch('/api/auth/me', { method: 'GET' })
      if (cancelled) return
      if (res.ok) {
        setUser((await res.json()) as AuthUser)
        setStatus('authenticated')
      } else {
        tokenStore.set(null) // token válido pero no para este tenant → anónimo acá
        setUser(null)
        setStatus('anonymous')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    })
    const data = (await res.json().catch(() => null)) as (AuthUser & { token: string }) | { error?: string; message?: string } | null
    if (!res.ok) throw new AuthError(res.status, data as { error?: string; message?: string })

    const { token, ...rest } = data as AuthUser & { token: string }
    tokenStore.set(token)
    setUser(rest as AuthUser)
    setStatus('authenticated')
    return rest as AuthUser
  }, [])

  const register = useCallback(async (payload: RegisterPayload): Promise<{ message: string }> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null
    if (!res.ok) throw new AuthError(res.status, data)
    return { message: data?.message ?? 'Cuenta creada' }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    tokenStore.set(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  // El backend nunca revela si el email existe (siempre 204) — no hay nada
  // que distinguir acá salvo errores reales de red/servidor (429, 500).
  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new AuthError(res.status, data)
    }
  }, [])

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    })
    const data = (await res.json().catch(() => null)) as
      | { userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN' }
      | { error?: string; message?: string }
      | null
    if (!res.ok) throw new AuthError(res.status, data as { error?: string; message?: string })
    return data as { userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN' }
  }, [])

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
