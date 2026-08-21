import { useEffect, useId, useRef, type RefObject } from 'react'
import {
  MOODS,
  approach,
  bodyPath,
  eyePath,
  rgb,
  type AgentMood,
  type Pose,
} from './pose'

interface Props {
  /** Rendered size in pixels. Legible from about 18px up. */
  size?: number
  mood?: AgentMood
  /**
   * Where to look, in units of eye travel (-1…1 on each axis). A ref and not a
   * value: the canvas moves the gaze every frame, and a prop would mean a
   * React render per frame to do it. Left out, the eyes drift on their own,
   * which is what keeps a still face alive.
   */
  gaze?: RefObject<{ x: number; y: number } | null>
  className?: string
  /** Read out to assistive tech; the face itself is decoration. */
  title?: string
}

/** Longest frame we integrate: a backgrounded tab must not teleport the face. */
const MAX_FRAME_S = 0.05
const BLINK_S = 0.14
const BLINK_GAP_MIN_S = 1.8
const BLINK_GAP_VAR_S = 3.6

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The agent, as a face. It is driven by one animation frame loop that writes
 * SVG attributes directly: React renders the element once and never re-renders
 * it for the animation, so a busy canvas costs no reconciliation.
 */
export default function Bloub({
  size = 24,
  mood = 'idle',
  gaze,
  className = '',
  title,
}: Props) {
  const gradientId = useId()
  const root = useRef<SVGGElement>(null)
  const body = useRef<SVGPathElement>(null)
  const eyes = useRef<SVGGElement>(null)
  const left = useRef<SVGPathElement>(null)
  const right = useRef<SVGPathElement>(null)
  const stopTop = useRef<SVGStopElement>(null)
  const stopBottom = useRef<SVGStopElement>(null)

  // Mood and gaze reach the loop through refs: changing either must not tear
  // down the animation, or every state change would restart the drift.
  const target = useRef<Pose>(MOODS[mood])
  const look = useRef(gaze)
  const thinking = useRef(mood === 'think')
  useEffect(() => {
    target.current = MOODS[mood]
    thinking.current = mood === 'think'
  }, [mood])
  useEffect(() => {
    look.current = gaze
  }, [gaze])

  useEffect(() => {
    const pose: Pose = { ...target.current }
    const still = prefersReducedMotion()

    let frame = 0
    let previous = performance.now() / 1000
    let clock = 0
    let nextBlink = BLINK_GAP_MIN_S
    let blinkStart = -1

    const draw = (): void => {
      const aim = look.current?.current
      const gazeX = aim
        ? aim.x * 3.2
        : 2.4 * Math.sin(clock * 0.7) + 1.1 * Math.sin(clock * 0.29 + 1.3)
      const gazeY = aim
        ? aim.y * 2.4
        : 1.6 * Math.sin(clock * 0.53 + 0.7)

      // A blink is a half-sine on the eye's height, so it closes and opens
      // with weight instead of stepping between two frames.
      let openness = 1
      if (blinkStart >= 0) {
        const progress = (clock - blinkStart) / BLINK_S
        if (progress >= 1) {
          blinkStart = -1
          nextBlink = clock + BLINK_GAP_MIN_S + Math.random() * BLINK_GAP_VAR_S
        } else {
          openness = 1 - Math.sin(Math.PI * progress)
        }
      } else if (clock > nextBlink) {
        blinkStart = clock
      }

      // Concentrating has a pulse to it; everything else sits still.
      const bob =
        still ? 0 : Math.sin(clock * 4.2) * (thinking.current ? 0.9 : 0.25)

      root.current?.setAttribute(
        'transform',
        `rotate(${pose.tilt.toFixed(2)} 50 50) translate(0 ${bob.toFixed(2)})`,
      )
      body.current?.setAttribute('d', bodyPath(pose.rx, pose.ry, pose.squircle))
      stopTop.current?.setAttribute('stop-color', rgb(pose.from))
      stopBottom.current?.setAttribute('stop-color', rgb(pose.to))

      const eyeH = Math.max(0.55, pose.eyeH * openness)
      const shape = eyePath(pose.eyeW, eyeH, pose.curve * openness)
      const lean = `rotate(${(-pose.lean).toFixed(2)})`
      left.current?.setAttribute('d', shape)
      right.current?.setAttribute('d', shape)
      left.current?.setAttribute(
        'transform',
        `translate(${(50 - pose.spread).toFixed(2)} ${(50 + pose.lift).toFixed(2)}) ${lean}`,
      )
      right.current?.setAttribute(
        'transform',
        `translate(${(50 + pose.spread).toFixed(2)} ${(50 + pose.lift).toFixed(2)}) ${lean}`,
      )
      eyes.current?.setAttribute(
        'transform',
        `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`,
      )
    }

    const tick = (now: number): void => {
      const seconds = now / 1000
      const dt = Math.min(MAX_FRAME_S, Math.max(0, seconds - previous))
      previous = seconds
      clock += dt
      approach(pose, target.current, dt)
      draw()
      frame = requestAnimationFrame(tick)
    }

    if (still) {
      // No loop at all: one frame in the target pose, eyes open, no drift.
      Object.assign(pose, target.current)
      draw()
      return
    }

    // The first frame is drawn now rather than on the next tick: an empty
    // path for one frame is a visible flash, and a tab that never composites
    // would leave the face blank forever.
    draw()
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0.35" y2="1">
          <stop ref={stopTop} offset="0" stopColor={rgb(MOODS[mood].from)} />
          <stop ref={stopBottom} offset="1" stopColor={rgb(MOODS[mood].to)} />
        </linearGradient>
      </defs>
      <g ref={root}>
        <path ref={body} fill={`url(#${gradientId})`} />
        <g ref={eyes}>
          <path ref={left} fill="#ffffff" />
          <path ref={right} fill="#ffffff" />
        </g>
      </g>
    </svg>
  )
}
