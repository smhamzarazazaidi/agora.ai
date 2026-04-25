import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import { useDebate } from '../hooks/useDebate'
import { useAuthStore } from '../store/authStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const session = useAuthStore(s => s.session)
  const { debates, setActiveDebate, deleteDebate } = useDebate()

  const handleOpen = (id: string) => {
    setActiveDebate(id)
    navigate(`/debate/${id}`)
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <>
      <Navbar variant="app" />
      <div className="dashboard-wrap">
        <div className="dashboard-header">
          <div>
            <div style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.4rem' }}>
              Welcome back
            </div>
            <h1 className="dashboard-title">{session?.name}'s Debates</h1>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/debate')}>
            + New Debate
          </button>
        </div>

        {debates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <div className="empty-title">No debates yet</div>
            <p className="empty-sub">Start your first AI debate to see it here.</p>
            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/debate')}>
              Start a Debate
            </button>
          </div>
        ) : (
          <div className="debate-list">
            {debates.map(d => (
              <div className="debate-item" key={d.id || (d as any)._id} onClick={() => handleOpen(d.id || (d as any)._id)}>
                <div>
                  <div className="debate-item-idea">"{d.idea}"</div>
                  <div className="debate-item-meta">
                    {d.rounds} rounds · {d.mode} · {fmt(d.createdAt)} · {d.messages.length} messages
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <span className={`debate-item-badge ${d.status === 'done' ? 'badge-done' : 'badge-running'}`}>
                    {d.status === 'done' ? 'Complete' : d.status}
                  </span>
                  <button
                    className="btn btn-ghost"
                    title="Delete debate"
                    style={{ fontSize: '.85rem', padding: '.3rem .65rem', color: 'var(--color-text-mut)' }}
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm('Delete this debate?')) deleteDebate(d.id)
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
