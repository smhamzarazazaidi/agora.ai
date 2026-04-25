import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { Send, Loader2, MessageSquarePlus } from 'lucide-react'
import { ContinuationIntensity, SSEEvent, Message } from '../../../shared/types'
import { continueDebateStream } from '../../services/api'
import { useDebateStore } from '../../store/debateStore'
import AgentMessage from './AgentMessage'

interface Props {
  debateId: string
}

type IntensityOption = { value: ContinuationIntensity; label: string; emoji: string; desc: string }

const INTENSITIES: IntensityOption[] = [
  { value: 'low',    label: 'Low',    emoji: '🟢', desc: '1 AI responds' },
  { value: 'medium', label: 'Medium', emoji: '🟡', desc: '2 AIs respond' },
  { value: 'high',   label: 'High',   emoji: '🔴', desc: 'All 3 respond' },
]

export default function ContinuationPanel({ debateId }: Props) {
  const store = useDebateStore()
  const [input, setInput] = useState('')
  const intensity: ContinuationIntensity = 'high'
  const [isRunning, setIsRunning] = useState(false)
  const [typing, setTyping] = useState<{ agent: string } | null>(null)
  const [streamedMsgs, setStreamedMsgs] = useState<Message[]>([])
  const cancelRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamedMsgs, typing])

  const submit = () => {
    if (!input.trim() || isRunning) return
    const question = input.trim()
    setInput('')
    setIsRunning(true)
    setTyping(null)

    const debate = store.debates.find(d => d.id === debateId);
    const maxRound = debate?.messages.reduce((max, m) => Math.max(max, m.round || 0), 0) || 0;
    const continuationRound = maxRound + 1;

    const userMsg: Message = {
      id: uuidv4(),
      agent: 'You',
      role: 'user',
      color: 'purple',
      summary: question,
      content: '',
      round: continuationRound,
      createdAt: new Date().toISOString(),
    };
    store.addMessage(debateId, userMsg);

    cancelRef.current = continueDebateStream(
      { debateId, followUp: question, intensity },
      (event: SSEEvent) => {
        if (event.type === 'typing') {
          setTyping({ agent: event.agent })
        } else if (event.type === 'continuation_message') {
          setTyping(null)
          // Push to global store so it appears in the main rounds view
          store.addMessage(debateId, event.message)
          setStreamedMsgs(prev => [...prev, event.message])
        }
      },
      (err) => {
        console.error('[Continuation]', err)
        setIsRunning(false)
        setTyping(null)
      },
      () => {
        setIsRunning(false)
        setTyping(null)
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className="mt-6">
      {/* ── Divider with label ── */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <MessageSquarePlus className="w-4 h-4 text-[var(--color-primary)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-mut)]">Continue Discussion</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[var(--color-border)] to-transparent" />
      </div>

      <p className="text-center text-xs text-[var(--color-text-mut)] mb-5 -mt-2">
        The debate never ends — ask anything to continue the reasoning loop
      </p>



      {/* ── Typing indicator for continuation ── */}
      <AnimatePresence>
        {typing && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 mb-3 px-1 text-sm"
          >
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
            <span className="font-semibold text-[var(--color-text)]">{typing.agent}</span>
            <span className="text-[var(--color-text-mut)]">is reasoning…</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={bottomRef} />

      {/* ── Input Row ── */}
      <div className="flex gap-2 items-end">
        <textarea
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder="Ask a follow-up or challenge the conclusion…"
          className="flex-1 resize-none bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-mut)] focus:outline-none focus:border-[var(--color-primary)] transition-colors leading-relaxed disabled:opacity-60"
        />
        <button
          onClick={submit}
          disabled={isRunning || !input.trim()}
          className="h-[58px] w-[58px] shrink-0 flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isRunning
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Send className="w-5 h-5" />
          }
        </button>
      </div>

      <p className="text-[11px] text-[var(--color-text-mut)] mt-2 text-center">
        <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-alt)] border border-[var(--color-border)] text-[10px]">Enter</kbd> to send &nbsp;·&nbsp;
        <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-alt)] border border-[var(--color-border)] text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  )
}
