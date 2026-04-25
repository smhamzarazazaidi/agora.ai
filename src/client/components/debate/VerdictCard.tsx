import { motion } from 'framer-motion'
import { Verdict } from '../../../shared/types'

interface Props { verdict: Verdict }

export default function VerdictCard({ verdict }: Props) {
  return (
    <motion.div
      className="verdict-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="verdict-header pb-4 border-b border-[var(--color-border)]">
        <span className="verdict-icon">✦</span>
        <div>
          <div className="verdict-title-label text-xs uppercase tracking-wide text-[var(--color-text-mut)] font-semibold">Consensus Conclusion</div>
          <div className="verdict-main text-lg font-medium text-[var(--color-text)] mt-1">{verdict.agreed_statement}</div>
        </div>
      </div>
      <div className="verdict-body pt-4 space-y-4">
        <div className="verdict-section">
          <div className="verdict-section-title text-sm font-semibold text-[var(--color-text-mut)] mb-2">Confirmed By</div>
          <div className="flex gap-2">
            {(verdict.confirmed_by || []).map((agent, i) => (
              <span key={i} className="px-2 py-1 bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded text-xs font-medium text-[var(--color-text)]">
                {agent}
              </span>
            ))}
          </div>
        </div>
        
        {verdict.minority_note && (
          <div className="verdict-section">
            <div className="verdict-section-title text-sm font-semibold text-[var(--color-text-mut)] mb-1">Minority Note / Caveat</div>
            <p className="text-sm text-[var(--color-text)] bg-[var(--color-bg-alt)] p-3 rounded border border-[var(--color-border)]">
              {verdict.minority_note}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
