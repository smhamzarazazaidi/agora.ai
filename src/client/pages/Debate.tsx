import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import DebateSidebar from '../components/debate/DebateSidebar'
import DebateArena from '../components/debate/DebateArena'
import { useDebate } from '../hooks/useDebate'

export default function Debate() {
  const { id } = useParams<{ id?: string }>()
  const { setActiveDebate, getDebate } = useDebate()

  // If navigating to a specific debate ID (from dashboard), load it
  useEffect(() => {
    if (id) {
      const debate = getDebate(id)
      if (debate) setActiveDebate(id)
    } else {
      setActiveDebate(null)
    }
  }, [id])

  const { startDebate } = useDebate()

  const handleStart = (idea: string, rounds: number, mode: 'fast' | 'deep') => {
    startDebate(idea, rounds, mode)
  }

  return (
    <>
      <Navbar variant="app" />
      <div className="app-wrap">
        <DebateSidebar onStart={handleStart} />
        <DebateArena />
      </div>
    </>
  )
}
