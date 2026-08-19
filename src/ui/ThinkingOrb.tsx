import type { CSSProperties } from 'react'

export type OrbTone = 'idle' | 'thinking' | 'ok' | 'error'

interface Props {
  /** Diameter in pixels. */
  size?: number
  tone?: OrbTone
  /** Adds the sweeping ring and speeds the orb up while a call is in flight. */
  busy?: boolean
  className?: string
}

interface Lobe {
  /** Where the lobe's hotspot sits before it starts orbiting. */
  at: string
  /** Seconds for one full orbit. */
  duration: number
  reverse: boolean
  /** Index into a tone's colour triple. */
  colour: 0 | 1 | 2
}

const LOBES: readonly Lobe[] = [
  { at: '30% 32%', duration: 7, reverse: false, colour: 0 },
  { at: '68% 40%', duration: 11, reverse: true, colour: 1 },
  { at: '46% 72%', duration: 9, reverse: false, colour: 2 },
]

/** Three colours per tone, one per lobe, so each state has its own mood. */
const TONES: Record<OrbTone, readonly [string, string, string]> = {
  idle: [
    'rgb(148 163 184 / 0.75)',
    'rgb(148 163 184 / 0.45)',
    'rgb(100 116 139 / 0.5)',
  ],
  thinking: [
    'rgb(59 130 246 / 0.95)',
    'rgb(168 85 247 / 0.75)',
    'rgb(34 211 238 / 0.7)',
  ],
  ok: [
    'rgb(34 197 94 / 0.9)',
    'rgb(16 185 129 / 0.65)',
    'rgb(132 204 22 / 0.6)',
  ],
  error: [
    'rgb(239 68 68 / 0.95)',
    'rgb(244 114 182 / 0.65)',
    'rgb(249 115 22 / 0.6)',
  ],
}

/**
 * A soft orb whose gradient lobes orbit at different speeds. It reads as
 * something thinking rather than as a spinner counting down to nothing, which
 * is what an agent working on the canvas actually looks like: open-ended.
 */
export default function ThinkingOrb({
  size = 22,
  tone = 'idle',
  busy = false,
  className = '',
}: Props) {
  const colors = TONES[tone]

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className={`orb h-full w-full ${busy ? 'orb--busy' : ''}`}>
        {LOBES.map((lobe) => (
          <span
            key={lobe.at}
            className="orb-lobe"
            style={
              {
                background: `radial-gradient(circle at ${lobe.at}, ${colors[lobe.colour]}, transparent 58%)`,
                animationDuration: `${busy ? lobe.duration / 3 : lobe.duration}s`,
                animationDirection: lobe.reverse ? 'reverse' : 'normal',
                filter: `blur(${Math.max(2, size / 8)}px)`,
              } satisfies CSSProperties
            }
          />
        ))}
      </span>
      {busy && <span className="orb-ring" aria-hidden />}
    </span>
  )
}
