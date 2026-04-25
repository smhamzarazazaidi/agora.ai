import { useEffect, useRef, useState } from 'react'
import { useDebate } from '../../hooks/useDebate'
import AgentMessage from './AgentMessage'
import TypingIndicator from './TypingIndicator'
import VerdictCard from './VerdictCard'
import RoundHeader from './RoundHeader'
import SandboxPanel from './SandboxPanel'
import ContinuationPanel from './ContinuationPanel'
import { Message } from '../../../shared/types'
import { Terminal } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export default function DebateArena() {
  const { getActiveDebate, typing } = useDebate()
  const debate = getActiveDebate()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [sandboxOpen, setSandboxOpen] = useState(false)

  // Auto-scroll on new messages
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [debate?.messages.length, typing])

  // Group messages by round
  const rounds: Record<number, Message[]> = {}
  debate?.messages.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = []
    rounds[m.round].push(m)
  })

  const statusText = () => {
    if (!debate) return 'Ready to begin'
    if (debate.status === 'running') {
      return `Running · Round ${Math.floor((debate.messages.length) / 3) + 1} of ${debate.rounds}`
    }
    if (debate.status === 'done') return 'Completed · Continuing discussion…'
    if (debate.status === 'error') return 'Error — please try again'
    return 'Ready to begin'
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <main className="debate-arena flex-1 border-r-0">
        <div className="arena-header flex justify-between items-center">
          <div>
            <div className="arena-title">Debate Session</div>
            <div className="arena-idea">
              {debate?.idea ? `"${debate.idea}"` : 'Enter an idea and press Start Debate'}
            </div>
            <div className="arena-meta">{statusText()}</div>
          </div>
          <button 
            onClick={() => setSandboxOpen(!sandboxOpen)}
            className={`flex items-center px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wide transition-colors ${sandboxOpen ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-alt)] text-[var(--color-text-mut)] hover:text-white border border-[var(--color-border)]'}`}
          >
            <Terminal className="w-4 h-4 mr-2" />
            Sandbox
          </button>
        </div>

      <div className="arena-body" ref={bodyRef}>
        {!debate || debate.messages.length === 0 && !typing ? (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <div className="empty-title">No debate running</div>
            <p className="empty-sub">Enter your idea in the left panel<br />and press <strong>Start Debate</strong></p>
          </div>
        ) : (
          <>
            {Object.entries(rounds).map(([round, msgs]) => {
              const r = Number(round);
              return (
                <div key={round}>
                  <div className="round-block">
                    <RoundHeader
                      round={r}
                      isContinuation={debate ? r > debate.rounds : false}
                    />
                    {msgs.map((msg, i) => (
                      <AgentMessage key={msg.id} message={msg} index={i} />
                    ))}
                  </div>
                  {r === debate?.rounds && debate?.verdict && (
                    <VerdictCard verdict={debate.verdict} />
                  )}
                </div>
              );
            })}

            {typing && (
              <TypingIndicator agent={typing.agent} />
            )}

            {debate?.verdict && (
              <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
                  >
                    <ContinuationPanel debateId={debate.id} />
                  </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>
      </main>
      <AnimatePresence>
        {sandboxOpen && <SandboxPanel onClose={() => setSandboxOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
