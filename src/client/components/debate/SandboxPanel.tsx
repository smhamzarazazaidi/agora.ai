import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, X, Terminal } from 'lucide-react';

interface Props {
  onClose: () => void;
  initialCode?: string;
}

export default function SandboxPanel({ onClose, initialCode }: Props) {
  const [code, setCode] = useState(initialCode || '// Write or paste Javascript here\nconsole.log("AGORA AI Sandbox Ready");\n');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const runCode = async () => {
    setRunning(true);
    setError('');
    setOutput('Executing...');
    
    try {
      const authState = localStorage.getItem('auth-storage');
      let token = '';
      if (authState) {
        try { token = JSON.parse(authState).state.token || ''; } catch {}
      }

      const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const res = await fetch(`${BASE}/api/code/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ language: 'javascript', code })
      });
      
      const data = await res.json();
      if (data.status === 'error') {
        setError(data.error || 'Execution failed');
        setOutput(data.output || '');
      } else {
        setOutput(data.output || 'No output returned');
        setError('');
      }
    } catch (err: any) {
      setError('Network or server error');
      setOutput('');
    } finally {
      setRunning(false);
    }
  };

  const clearSandbox = () => {
    setCode('');
    setOutput('');
    setError('');
  };

  return (
    <motion.div 
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-80 h-full border-l border-[var(--color-border)] bg-[#111111] flex flex-col shrink-0"
    >
      <div className="h-[60px] flex items-center justify-between px-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center text-sm font-bold text-white tracking-wide uppercase">
          <Terminal className="w-4 h-4 mr-2 text-[var(--color-primary)]" />
          Code Sandbox
        </div>
        <button onClick={onClose} className="text-[var(--color-text-mut)] hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        <div className="flex flex-col flex-1 gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-mut)] font-semibold">JavaScript Editor</span>
            <div className="flex gap-2">
              <button 
                onClick={clearSandbox}
                className="p-1.5 rounded bg-[#222] hover:bg-[#333] text-[var(--color-text-mut)] hover:text-white transition-colors"
                title="Clear Editor"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={runCode}
                disabled={running || !code.trim()}
                className="flex items-center px-3 py-1.5 rounded bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition-opacity"
              >
                <Play className="w-3.5 h-3.5 mr-1" />
                {running ? 'Running' : 'Run'}
              </button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
            className="flex-1 w-full bg-[#0A0A0A] border border-[var(--color-border)] rounded-md p-3 text-[13px] text-[#A6E22E] font-mono leading-relaxed resize-none focus:outline-none focus:border-[#444]"
            placeholder="// Write code here..."
            style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
          />
        </div>

        <div className="h-1/3 flex flex-col gap-2 shrink-0">
          <span className="text-xs uppercase tracking-wide text-[var(--color-text-mut)] font-semibold">Output</span>
          <div className="flex-1 w-full bg-[#0A0A0A] border border-[var(--color-border)] rounded-md p-3 overflow-auto font-mono text-[13px]">
            {error && (
              <div className="text-red-400 mb-2 whitespace-pre-wrap">Error: {error}</div>
            )}
            {output && (
              <div className="text-[#E6DB74] whitespace-pre-wrap">{output}</div>
            )}
            {!error && !output && (
              <div className="text-[var(--color-text-mut)] italic">Output will appear here</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
