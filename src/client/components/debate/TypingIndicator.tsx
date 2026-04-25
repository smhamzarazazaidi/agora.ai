import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface Props {
  agent: string
}

export default function TypingIndicator({ agent }: Props) {
  return (
    <motion.div
      className="typing-indicator"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="typing-header flex items-center justify-between w-full">
        <div>
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)] inline-block mr-2" />
          <span className="typing-name text-sm font-semibold text-[var(--color-text)]">{agent}</span>
          <span className="typing-role text-xs text-[var(--color-text-mut)] ml-2">is reasoning…</span>
        </div>
      </div>
    </motion.div>
  )
}
