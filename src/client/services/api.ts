/// <reference types="vite/client" />
import { SSEEvent, StartDebateRequest, ContinueDebateRequest } from '../../shared/types'

let BASE = import.meta.env.VITE_API_BASE_URL || ''
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && BASE.includes('localhost')) {
  BASE = ''
}

export function startDebateStream(
  payload: StartDebateRequest,
  onEvent: (event: SSEEvent) => void,
  onError: (err: string) => void,
  onDone: () => void
): () => void {
  let closed = false

  // Use fetch + ReadableStream for POST-based SSE
  const controller = new AbortController()

  const authState = localStorage.getItem('auth-storage');
  let token = '';
  if (authState) {
    try {
      token = JSON.parse(authState).state.token || '';
    } catch {}
  }

  const isDeep = payload.mode === 'deep'
  const url = isDeep ? `${BASE}/api/debate/reason` : `${BASE}/api/debate/start`
  const body = isDeep 
    ? JSON.stringify({ idea: payload.idea, maxIterations: payload.rounds })
    : JSON.stringify(payload)

  fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body,
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || closed) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim()
          if (!line || line.startsWith(':')) continue
          const data = line.replace(/^data:\s*/, '')
          try {
            const event = JSON.parse(data) as SSEEvent
            if (event.type === 'done') { onDone(); return }
            onEvent(event)
          } catch { /* ignore malformed */ }
        }
      }
      if (!closed) onDone()
    })
    .catch((err) => {
      if (!closed) onError(err.message || 'Connection error')
    })

  return () => {
    closed = true
    controller.abort()
  }
}

function getToken(): string {
  try {
    return JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token || ''
  } catch { return '' }
}

export function continueDebateStream(
  payload: ContinueDebateRequest,
  onEvent: (event: SSEEvent) => void,
  onError: (err: string) => void,
  onDone: () => void
): () => void {
  let closed = false
  const controller = new AbortController()

  fetch(`${BASE}/api/debate/continue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || closed) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim()
          if (!line || line.startsWith(':')) continue
          const data = line.replace(/^data:\s*/, '')
          try {
            const event = JSON.parse(data) as SSEEvent
            if (event.type === 'done') { onDone(); return }
            onEvent(event)
          } catch { /* ignore malformed */ }
        }
      }
      if (!closed) onDone()
    })
    .catch((err) => {
      if (!closed) onError(err.message || 'Connection error')
    })

  return () => {
    closed = true
    controller.abort()
  }
}
