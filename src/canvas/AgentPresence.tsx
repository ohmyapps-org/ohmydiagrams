import { useStore } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { useAgentActivity } from '../store/agent'
import Bloub from '../ui/agent/Bloub'
import { useAgentState } from '../ui/agent/mood'
import type { Point } from '../uml/geometry'

const FACE_PX = 40
/** Face plus caption, so it stands above the element instead of on top of it. */
const STAND_OFF_PX = 46
/** Share of the remaining distance covered per second, travelling and fading. */
const TRAVEL_RATE = 5.5
const FADE_RATE = 7
/** Distance over which the eyes stay fully turned towards the target. */
const GAZE_REACH_PX = 160

/**
 * The agent, standing on the canvas where it is working.
 *
 * It travels in flow coordinates and is only projected to the screen at draw
 * time, so panning and zooming carry it along with the diagram instead of
 * leaving it behind. Nothing here re-renders per frame: position, gaze and
 * opacity are written straight to the DOM by one animation loop, which stops
 * itself once the face has faded out.
 */
export default function AgentPresence() {
  const { mood, busy, reacting, latest, connected } = useAgentState()
  const focus = useAgentActivity((state) => state.focus)
  const transform = useStore((state) => state.transform)

  const visible = connected && focus !== null && (busy || reacting)
  const failed = latest?.status === 'error'

  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const gaze = useRef<Point | null>({ x: 0, y: 0 })
  const target = useRef<Point | null>(focus)
  const view = useRef(transform)
  const shown = useRef(visible)
  /** Where the face actually is, in flow coordinates. Its own copy. */
  const at = useRef<Point | null>(null)
  /** Mounted only while there is something to show, so the loop can rest. */
  const [alive, setAlive] = useState(false)

  useEffect(() => {
    view.current = transform
  }, [transform])

  useEffect(() => {
    shown.current = visible
    if (visible) setAlive(true)
  }, [visible])

  useEffect(() => {
    target.current = focus
    // Turning up somewhere new is a cut, not a flight across the diagram.
    if (focus && at.current === null) at.current = { ...focus }
  }, [focus])

  useEffect(() => {
    if (!alive) return
    let frame = 0
    let previous = performance.now() / 1000
    let opacity = 0

    const tick = (now: number): void => {
      const seconds = now / 1000
      const dt = Math.min(0.05, Math.max(0, seconds - previous))
      previous = seconds

      opacity += ((shown.current ? 1 : 0) - opacity) * (1 - Math.exp(-FADE_RATE * dt))
      if (card.current) card.current.style.opacity = opacity.toFixed(3)

      const goal = target.current
      const here = at.current
      if (goal && here) {
        const k = 1 - Math.exp(-TRAVEL_RATE * dt)
        here.x += (goal.x - here.x) * k
        here.y += (goal.y - here.y) * k

        const [panX, panY, zoom] = view.current
        // Look where it is going, then down at the work once it arrives.
        const aim = gaze.current
        if (aim) {
          aim.x = clamp(((goal.x - here.x) * zoom) / GAZE_REACH_PX)
          aim.y = clamp(((goal.y - here.y) * zoom) / GAZE_REACH_PX + 0.45)
        }
        const x = here.x * zoom + panX
        const y = here.y * zoom + panY - STAND_OFF_PX
        if (root.current) {
          root.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        }
      }

      // Faded out and not coming back: drop the loop and the element with it.
      if (!shown.current && opacity < 0.01) {
        at.current = null
        setAlive(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    // Place it before the first tick, so it never shows up at the origin.
    tick(previous * 1000)
    return () => cancelAnimationFrame(frame)
  }, [alive])

  if (!alive) return null

  return (
    <div
      ref={root}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-30 will-change-transform"
    >
      <div
        ref={card}
        style={{ opacity: 0 }}
        className="flex -translate-x-1/2 -translate-y-full items-center gap-1.5"
      >
        <Bloub size={FACE_PX} mood={mood} gaze={gaze} />
        {latest && (
          <span
            className={`glass whitespace-nowrap rounded-panel px-2 py-1 text-[11.5px] font-medium ${
              failed ? 'text-danger' : 'text-ink'
            }`}
          >
            {latest.label}
          </span>
        )}
      </div>
    </div>
  )
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value))
}
