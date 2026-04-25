import { create } from 'zustand'
import { Debate, Message, Verdict } from '../../shared/types'

let BASE = import.meta.env.VITE_API_BASE_URL || ''
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && BASE.includes('localhost')) {
  BASE = ''
}

interface DebateState {
  debates: Debate[]
  activeDebateId: string | null
  isRunning: boolean
  typing: { agent: string } | null
  
  // Actions
  fetchDebates: (token: string) => Promise<void>
  deleteDebate: (id: string, token: string) => Promise<void>
  
  setActiveDebate: (id: string | null) => void
  setRunning: (running: boolean) => void
  setTyping: (typing: { agent: string } | null) => void
  
  // SSE Mutation Actions
  addDebate: (debate: Debate) => void
  setStatus: (id: string, status: Debate['status']) => void
  addMessage: (id: string, message: Message) => void
  setVerdict: (id: string, verdict: Verdict) => void
}

export const useDebateStore = create<DebateState>((set, get) => ({
  debates: [],
  activeDebateId: null,
  isRunning: false,
  typing: null,

  fetchDebates: async (token) => {
    try {
      const res = await fetch(`${BASE}/api/debate`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const debates = await res.json()
        set({ debates })
      }
    } catch (err) {
      console.error('Failed to fetch debates:', err)
    }
  },

  deleteDebate: async (id, token) => {
    try {
      const res = await fetch(`${BASE}/api/debate/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        set(state => ({
          debates: state.debates.filter(d => d.id !== id),
          activeDebateId: state.activeDebateId === id ? null : state.activeDebateId
        }))
      }
    } catch (err) {
      console.error('Failed to delete debate:', err)
    }
  },

  setActiveDebate: (id) => set({ activeDebateId: id }),
  setRunning: (running) => set({ isRunning: running }),
  setTyping: (typing) => set({ typing }),

  addDebate: (debate) => set(state => {
    // Prevent duplicates if init fires multiple times
    if (state.debates.find(d => d.id === debate.id)) return state
    return {
      debates: [debate, ...state.debates],
      activeDebateId: debate.id
    }
  }),

  setStatus: (id, status) => set(state => ({
    debates: state.debates.map(d => d.id === id ? { ...d, status } : d)
  })),

  addMessage: (id, message) => set(state => ({
    debates: state.debates.map(d => 
      d.id === id ? { ...d, messages: [...d.messages, message] } : d
    )
  })),

  setVerdict: (id, verdict) => set(state => ({
    debates: state.debates.map(d => 
      d.id === id ? { ...d, verdict } : d
    )
  }))
}))
