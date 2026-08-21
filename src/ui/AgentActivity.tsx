import { useEffect, useState } from 'react'
import { useBridge } from '../bridge/client'
import { useAgentActivity } from '../store/agent'
import Bloub from './agent/Bloub'
import { useAgentState } from './agent/mood'

const RELATIVE = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

function secondsAgo(at: number): string {
  const elapsed = Math.round((Date.now() - at) / 1000)
  if (elapsed < 3) return 'ahora'
  if (elapsed < 60) return RELATIVE.format(-elapsed, 'second')
  return RELATIVE.format(-Math.round(elapsed / 60), 'minute')
}

/**
 * What an agent is doing to this canvas, live. Every tool call — from the local
 * bridge or from a remote MCP platform — passes through one place in the client,
 * so this panel reports real work rather than an animation on a timer.
 */
export default function AgentActivity() {
  const status = useBridge((state) => state.status)
  const { mood, busy, latest, total } = useAgentState()
  const events = useAgentActivity((state) => state.events)
  const [open, setOpen] = useState(false)
  /** Re-renders the "hace N s" labels while the panel is open. */
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 5000)
    return () => window.clearInterval(timer)
  }, [open])

  // Nothing to report until the canvas is actually reachable by an agent.
  if (status === 'off') return null

  const failed = latest?.status === 'error'

  const headline =
    status === 'connecting'
      ? 'Buscando el agente…'
      : busy && latest
        ? latest.label
        : total === 0
          ? 'Agente conectado'
          : failed
            ? 'La última acción falló'
            : `${total} acción(es) en este lienzo`

  // Reversed column: the feed opens upward, away from the canvas edge.
  return (
    <div className="absolute bottom-3 left-3 z-40 flex max-w-[17rem] flex-col-reverse">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="glass flex w-full items-center gap-2 rounded-panel py-1.5 pl-1.5 pr-2.5 text-left transition hover:ring-1 hover:ring-accent"
      >
        <Bloub size={26} mood={mood} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-ink">
            {headline}
          </span>
          <span className="block text-[10.5px] text-faint">
            {status === 'connecting' ? 'Conectando' : 'Agente MCP'}
          </span>
        </span>
      </button>

      {open && events.length > 0 && (
        <ul className="glass mb-1.5 max-h-56 overflow-y-auto rounded-panel p-1.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="feed-entry flex items-baseline gap-2 rounded-control px-1.5 py-1"
            >
              <span
                aria-hidden
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                  event.status === 'error' ? 'bg-danger' : 'bg-ok'
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">
                {event.label}
              </span>
              <span className="shrink-0 text-[10.5px] text-faint">
                {secondsAgo(event.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
