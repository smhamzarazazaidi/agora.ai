import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Signup() {
  const navigate = useNavigate()
  const { signup, session, error, clearError } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (session) navigate('/dashboard') }, [session])
  useEffect(() => { return () => clearError() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return
    setLoading(true)
    await signup(name, email, password)
    setLoading(false)
  }

  return (
    <div className="auth-wrap">
      {/* ── Left panel ── */}
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-brand">AGORA <em>AI</em></div>
          <p className="auth-tagline">"Structured AI reasoning for better decisions"</p>
          <div className="auth-bullets">
            {['Multi-agent debate — not a single chatbot', 'Round-based structured arguments', 'Actionable verdicts every time', 'Free to start, no card required'].map(b => (
              <div className="auth-bullet" key={b}>
                <span className="auth-bullet-dot" />{b}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div className="auth-card">
          <h2 className="auth-card-title">Create account</h2>
          <p className="auth-card-sub">Start your first AI debate in minutes.</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Alex Johnson"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                placeholder="alex@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                required
              />
              {password.length > 0 && password.length < 8 && (
                <div className="form-error">Password must be at least 8 characters</div>
              )}
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: '.75rem', padding: '.7rem' }}
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              className="btn" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
              onClick={() => {
                const { bypassAuth } = useAuthStore.getState()
                bypassAuth()
              }}
            >
              🚀 Hackathon Bypass
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
