/// <reference types="vite/client" />
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Session } from '../../shared/types'

let BASE = import.meta.env.VITE_API_BASE_URL || ''
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && BASE.includes('localhost')) {
  BASE = ''
}

interface AuthState {
  session: Session | null
  token: string | null
  error: string | null
  signup: (name: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  bypassAuth: () => void
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      token: null,
      error: null,

      signup: async (name, email, password) => {
        try {
          const res = await fetch(`${BASE}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.message || 'Signup failed')
          
          set({
            session: { userId: data.id, name: data.name, email: data.email },
            token: data.token,
            error: null,
          })
        } catch (err: any) {
          set({ error: err.message })
        }
      },

      login: async (email, password) => {
        try {
          const res = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.message || 'Login failed')
          
          set({
            session: { userId: data.id, name: data.name, email: data.email },
            token: data.token,
            error: null,
          })
        } catch (err: any) {
          set({ error: err.message })
        }
      },

      bypassAuth: () => {
        set({
          session: { userId: 'hackathon-user', name: 'Hackathon Judge', email: 'judge@hackathon.com' },
          token: 'hackathon-bypass-token',
          error: null,
        })
      },

      logout: () => set({ session: null, token: null }),
      clearError: () => set({ error: null }),
    }),
    { name: 'auth-storage' }
  )
)
