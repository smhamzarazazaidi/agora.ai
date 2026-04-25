import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Message } from '../../../shared/types'
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react'

interface Props {
  message: Message
  index: number
}

export default function AgentMessage({ message, index }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      className={`msg-card ${message.role === 'user' ? 'right' : 'left'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.05 }}
    >
      <div className={`msg-inner ${message.color}`}>
        <div className="msg-agent flex justify-between items-center">
          <div>
            <span className={`agent-dot ${message.color}`} />
            <span className={`agent-name ${message.color} font-bold`}>{message.agent}</span>
          </div>
        </div>
        
        <div className="msg-text mt-2 font-medium text-[var(--color-text)] leading-relaxed">
          {message.summary}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-[var(--color-border)] text-[var(--color-text-mut)] text-sm whitespace-pre-wrap leading-relaxed overflow-hidden"
            >
              {message.content}
              
              {message.code_snippet && (
                <div className="mt-4 border border-[var(--color-border)] rounded-md overflow-hidden bg-[#0A0A0A]">
                  <div className="px-3 py-1.5 bg-[#1A1A1A] border-b border-[var(--color-border)] text-xs font-bold uppercase tracking-wider text-[var(--color-text-mut)] flex items-center">
                    <Terminal className="w-3.5 h-3.5 mr-2" />
                    AI Executed Code
                  </div>
                  <div className="p-3 text-[13px] font-mono text-[#A6E22E] overflow-x-auto whitespace-pre">
                    {message.code_snippet}
                  </div>
                  {message.code_output && (
                    <div className="px-3 py-2 bg-black border-t border-[var(--color-border)]">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-mut)] mb-1 font-bold">Output</div>
                      <div className="text-[13px] font-mono text-[#E6DB74] whitespace-pre-wrap">
                        {message.code_output}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {message.role !== 'user' && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center text-xs font-semibold text-[var(--color-text-mut)] hover:text-[var(--color-text)] transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3 mr-1" /> Hide Reasoning</>
            ) : (
              <><ChevronDown className="w-3 h-3 mr-1" /> Expand Reasoning</>
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}
