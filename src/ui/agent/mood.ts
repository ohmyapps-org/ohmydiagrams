import { useEffect, useState } from 'react'
import { useBridge } from '../../bridge/client'
import { useAgentActivity, type AgentEvent } from '../../store/agent'
import type { AgentMood } from './pose'

/**
 * How long the face holds a win or a failure before settling back to idle.
 * Long enough to be read, short enough that the canvas does not keep grinning
 * at something that happened a minute ago.
 */
const REACTION_MS = 3200

export interface AgentState {
  mood: AgentMood
  /** A call is in flight, or just was. */
  busy: boolean
  /** Still showing the outcome of the last call. */
  reacting: boolean
  latest: AgentEvent | undefined
  /** Calls handled since the canvas connected. */
  total: number
  connected: boolean
}

/**
 * One reading of what the agent is doing, shared by every place that shows it
 * — the status chip, the connections menu, the face standing on the canvas —
 * so they can never disagree about the mood.
 */
export function useAgentState(): AgentState {
  const status = useBridge((state) => state.status)
  const busy = useAgentActivity((state) => state.busy)
  const events = useAgentActivity((state) => state.events)
  const total = useAgentActivity((state) => state.total)
  const latest = events[0]
  const [reacting, setReacting] = useState(false)

  // Keyed on the event id, so a burst of calls keeps extending the window
  // rather than each one restarting a half-finished expression.
  const latestId = latest?.id
  useEffect(() => {
    if (latestId === undefined) return
    setReacting(true)
    const timer = window.setTimeout(() => setReacting(false), REACTION_MS)
    return () => window.clearTimeout(timer)
  }, [latestId])

  const failed = latest?.status === 'error'
  const mood: AgentMood =
    status === 'off'
      ? 'sleep'
      : status === 'connecting'
        ? 'scan'
        : busy
          ? 'think'
          : reacting && failed
            ? 'error'
            : reacting
              ? 'ok'
              : 'idle'

  return {
    mood,
    busy,
    reacting,
    latest,
    total,
    connected: status === 'connected',
  }
}
