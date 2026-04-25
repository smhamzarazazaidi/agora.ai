import { useCallback, useEffect } from 'react'
import { useDebateStore } from '../store/debateStore'
import { useAuthStore } from '../store/authStore'
import { startDebateStream } from '../services/api'
import { SSEEvent } from '../../shared/types'

export function useDebate() {
  const store = useDebateStore()
  const { token } = useAuthStore()

  // Fetch debates on mount if we have a token
  useEffect(() => {
    if (token) {
      store.fetchDebates(token)
    }
  }, [token])

  const startDebate = useCallback(
    (idea: string, rounds: number, mode: 'fast' | 'deep') => {
      if (store.isRunning || !token) return

      store.setRunning(true)
      store.setTyping(null)

      let currentDebateId: string | null = null

      const cancel = startDebateStream(
        { idea, rounds, mode },
        (event: SSEEvent) => {
          if (event.type === 'init') {
            currentDebateId = event.debateId
            store.addDebate({
              id: currentDebateId,
              idea,
              rounds,
              mode,
              status: 'running',
              messages: [],
              verdict: null,
              createdAt: new Date().toISOString()
            })
          } else if (event.type === 'typing') {
            store.setTyping({ agent: event.agent })
          } else if ((event.type === 'message' || event.type === 'continuation_message') && currentDebateId) {
            store.setTyping(null)
            store.addMessage(currentDebateId, event.message)
          } else if (event.type === 'verdict' && currentDebateId) {
            store.setVerdict(currentDebateId, event.verdict)
          } else if (event.type === 'error') {
            if (currentDebateId) store.setStatus(currentDebateId, 'error')
            store.setRunning(false)
            store.setTyping(null)
          }
        },
        (err) => {
          console.error('SSE error:', err)
          if (currentDebateId) store.setStatus(currentDebateId, 'error')
          store.setRunning(false)
          store.setTyping(null)
        },
        () => {
          if (currentDebateId) store.setStatus(currentDebateId, 'done')
          store.setRunning(false)
          store.setTyping(null)
          // Disabled auto-refresh to prevent potential UI reset issues
          // store.fetchDebates(token)
        }
      )

      return cancel
    },
    [store, token]
  )

  const getActiveDebate = () => {
    return store.debates.find(d => d.id === store.activeDebateId) || null
  }

  const getDebate = (id: string) => {
    return store.debates.find(d => d.id === id) || null
  }

  const deleteDebateWrapper = (id: string) => {
    if (token) store.deleteDebate(id, token)
  }

  return { 
    startDebate, 
    getActiveDebate, 
    getDebate, 
    ...store,
    deleteDebate: deleteDebateWrapper 
  }
}
