import { useState } from 'react'
import { useDebate } from '../../hooks/useDebate'
import { Debate } from '../../../shared/types'

interface Props {
  onStart: (idea: string, rounds: number, mode: 'fast' | 'deep') => void
}

export default function DebateSidebar({ onStart }: Props) {
  const [idea, setIdea] = useState('')
  const [rounds, setRounds] = useState(3)
  const [mode, setMode] = useState<'fast' | 'deep'>('fast')
  const { isRunning, getActiveDebate } = useDebate()
  const debate = getActiveDebate()

  const status = debate?.status ?? 'idle'
  const completedRounds = debate
    ? Math.floor(debate.messages.filter(m => m.agent === 'AI-3').length)
    : 0

  const statusText = () => {
    if (!debate || status === 'idle') return 'Idle — ready'
    if (status === 'running') return `Round ${completedRounds + 1} of ${debate.rounds}`
    if (status === 'done') return 'Completed'
    if (status === 'error') return 'Error occurred'
    return 'Idle — ready'
  }

  const handleStart = () => {
    if (!idea.trim() || isRunning) return
    onStart(idea.trim(), rounds, mode)
  }

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-section-title">Your Idea</div>
        <textarea
          className="idea-input"
          placeholder="Enter your idea or problem to debate…"
          value={idea}
          onChange={e => setIdea(e.target.value)}
          disabled={isRunning}
        />
      </div>

      <div>
        <button
          className="btn btn-primary btn-full"
          style={{ padding: '.7rem' }}
          onClick={handleStart}
          disabled={isRunning || !idea.trim()}
        >
          {isRunning ? 'Running…' : status === 'done' ? '▶ New Debate' : '▶ Start Debate'}
        </button>
      </div>

      <div>
        <div className="sidebar-section-title">Settings</div>
        <div className="setting-row">
          <span className="setting-label">Rounds</span>
          <div className="rounds-control">
            <button className="round-btn" onClick={() => setRounds(r => Math.max(1, r - 1))} disabled={isRunning}>−</button>
            <span className="setting-value">{rounds}</span>
            <button className="round-btn" onClick={() => setRounds(r => Math.min(5, r + 1))} disabled={isRunning}>+</button>
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-label">Depth</span>
          <div className="toggle-wrap">
            <span className={`toggle-opt${mode === 'fast' ? ' active' : ''}`} onClick={() => !isRunning && setMode('fast')}>Fast</span>
            <span className={`toggle-opt${mode === 'deep' ? ' active' : ''}`} onClick={() => !isRunning && setMode('deep')}>Deep</span>
          </div>
        </div>
      </div>

      <div>
        <div className="sidebar-section-title">Status</div>
        <div className="status-indicator">
          <div className="status-label">Current state</div>
          <div className="status-value">
            <span className={`status-dot${status === 'running' ? ' running' : status === 'done' ? ' done' : ''}`} />
            <span>{statusText()}</span>
          </div>
          {debate && debate.rounds > 0 && (
            <div className="round-progress">
              {Array.from({ length: debate.rounds }).map((_, i) => (
                <div
                  key={i}
                  className={`round-pip${i < completedRounds ? ' done' : i === completedRounds && status === 'running' ? ' active' : ''}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
