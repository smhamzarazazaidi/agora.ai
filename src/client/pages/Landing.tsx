import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut', delay },
})

export default function Landing() {
  const navigate = useNavigate()

  return (
    <>
      <Navbar variant="landing" />

      {/* ── Hero ── */}
      <div className="hero">
        <motion.div className="hero-left" {...fadeUp(0)}>
          <div className="hero-badge">
            <span className="badge-dot" />
            Multi-agent reasoning system
          </div>
          <h1>Watch AI Think —<br /><em>Not Just Respond</em></h1>
          <p className="hero-sub">
            AGORA AI runs structured debates between AI agents to give you deeper,
            more reliable answers on any idea or problem.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
              Start a Debate
            </button>
            <a className="btn btn-secondary btn-lg" href="#how">See How It Works</a>
          </div>
        </motion.div>

        <motion.div className="hero-visual" {...fadeUp(0.1)}>
          <div className="debate-preview">
            <div className="debate-preview-header">
              <span className="preview-title">Live Session</span>
              <span className="preview-status">
                <span className="preview-dot" />Round 2 of 3
              </span>
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.75rem', fontStyle: 'italic' }}>
              "Should we expand into Southeast Asian markets now?"
            </div>
            <div className="preview-msg blue">
              <div className="agent-label">AI-1 · Optimist</div>
              Market timing is favorable — ASEAN GDP grew 5.1% last year, and digital adoption is accelerating. Early movers capture category leadership.
            </div>
            <div className="preview-msg green">
              <div className="agent-label">AI-2 · Critic</div>
              Regulatory variance across 10 countries adds 14–22 months to go-to-market. Infrastructure readiness in tier-2 cities remains a bottleneck.
            </div>
            <div className="preview-msg amber">
              <div className="agent-label">AI-3 · Realist</div>
              Phased entry — Singapore and Malaysia first — hedges risk while capturing growth. Revisit broader rollout in Q3 2026.
            </div>
            <div className="preview-verdict">
              <div className="verdict-label">Final Verdict</div>
              Proceed with a phased two-country pilot. Full expansion is premature but delaying entirely risks ceding ground.
            </div>
          </div>
        </motion.div>
      </div>

      <hr className="divider" />

      {/* ── How it works ── */}
      <div className="section" id="how">
        <div className="section-label">Process</div>
        <h2 className="section-title">Three steps to structured clarity</h2>
        <p className="section-sub">
          Not a chatbot. A structured reasoning engine where AI agents challenge each
          other until the best answer surfaces.
        </p>
        <div className="how-grid">
          {[
            { num: '01', icon: '✏️', title: 'Submit your idea', desc: 'Enter a question, decision, or problem. AGORA AI understands context and frames it as a structured debate proposition.' },
            { num: '02', icon: '⚡', title: 'AI agents debate in rounds', desc: 'Multiple agents argue, counter-argue, and synthesize across structured rounds. Each voice has a distinct reasoning lens.' },
            { num: '03', icon: '✦', title: 'Get a structured verdict', desc: 'A final card delivers a clear decision, strengths, weaknesses, and actionable next steps — not vague suggestions.' },
          ].map(s => (
            <div className="how-step" key={s.num}>
              <span className="step-num">{s.num}</span>
              <div className="step-icon">{s.icon}</div>
              <div className="step-title">{s.title}</div>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <hr className="divider" />

      {/* ── Features ── */}
      <div className="section" id="features">
        <div className="section-label">Capabilities</div>
        <h2 className="section-title">Built for rigorous reasoning</h2>
        <div className="features-grid">
          {[
            { icon: '◈', title: 'Multi-agent reasoning', desc: 'Dedicated agents with distinct cognitive stances — optimist, critic, realist — ensure every angle is genuinely challenged.' },
            { icon: '◷', title: 'Round-based debate structure', desc: 'Arguments evolve across rounds. Each agent reads what came before and builds a sharper response — not a scripted reply.' },
            { icon: '▤', title: 'Structured outputs', desc: 'Verdicts arrive as structured cards with sections for decision, strengths, weaknesses, and recommendations. Always actionable.' },
            { icon: '◎', title: 'Actionable insights', desc: 'The final verdict doesn\'t just analyze — it tells you exactly what to do next, with specific, prioritized recommendations.' },
          ].map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Start your first AI debate</h2>
          <p className="cta-sub">
            Stop getting vague AI responses. Get structured arguments, genuine
            disagreement, and a verdict you can act on.
          </p>
          <Link to="/signup" className="btn btn-white btn-lg">
            Try AGORA AI — it's free
          </Link>
        </div>
      </div>

      <Footer />
    </>
  )
}
