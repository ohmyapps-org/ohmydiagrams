import type { AgentMood } from './pose'
import { MOODS, rgb } from './pose'

interface Props {
  mood: AgentMood
  /** Diameter in pixels. */
  size?: number
  className?: string
}

/**
 * The face, reduced to the one thing that survives at badge size: its colour.
 * Below about 18px the eyes stop reading, so a corner badge shows the mood as
 * a dot from the same palette rather than an illegible smudge.
 */
export default function StatusDot({ mood, size = 8, className = '' }: Props) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ring-1 ring-surface transition-colors duration-500 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(to bottom, ${rgb(MOODS[mood].from)}, ${rgb(
          MOODS[mood].to,
        )})`,
      }}
    />
  )
}
