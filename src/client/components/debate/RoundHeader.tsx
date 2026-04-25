interface Props {
  round: number
  isContinuation?: boolean
}

export default function RoundHeader({ round, isContinuation }: Props) {
  return (
    <div className="round-header">
      <span className={`round-label ${isContinuation ? 'text-violet-400' : ''}`}>
        {isContinuation ? `∞ Follow-up · Session ${round}` : `Round ${round}`}
      </span>
      <div className="round-line" />
    </div>
  )
}
