import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function Navbar({ variant = 'landing' }: { variant?: 'landing' | 'app' }) {
  const session = useAuthStore(s => s.session)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">AGORA <em>AI</em></Link>
      <div className="nav-links">
        {variant === 'landing' && (
          <>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
          </>
        )}
        {session ? (
          <>
            <Link to="/dashboard" style={{ fontSize: '.875rem', color: 'var(--text2)', textDecoration: 'none' }}>Dashboard</Link>
            <button className="btn btn-ghost" onClick={handleLogout}>Sign out</button>
            <Link to="/debate" className="btn btn-primary">New Debate</Link>
          </>
        ) : (
          <>
            <Link to="/login" style={{ fontSize: '.875rem', color: 'var(--text2)', textDecoration: 'none' }}>Login</Link>
            <Link to="/signup" className="btn btn-primary">Start a Debate</Link>
          </>
        )}
      </div>
    </nav>
  )
}
