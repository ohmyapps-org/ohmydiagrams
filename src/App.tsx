import { ReactFlowProvider } from '@xyflow/react'
import { Minimize2 } from 'lucide-react'
import { useState } from 'react'
import Canvas from './canvas/Canvas'
import { useShortcuts } from './hooks/useShortcuts'
import { useLibrary } from './store/library'
import { useView } from './store/view'
import ChecklistPanel, { type ChecklistTab } from './ui/ChecklistPanel'
import Home from './ui/Home'
import Palette from './ui/Palette'
import PropertiesPanel from './ui/PropertiesPanel'
import Toasts from './ui/Toasts'
import TopBar from './ui/TopBar'

/** The only way out of zen mode that does not need a keyboard. */
function ZenExit() {
  const setZen = useView((state) => state.setZen)

  return (
    <button
      type="button"
      onClick={() => setZen(false)}
      title="Salir del modo zen (Z)"
      aria-label="Salir del modo zen"
      className="glass absolute right-4 top-4 z-40 flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[12.5px] font-medium text-muted transition hover:text-ink"
    >
      <Minimize2 size={14} />
      Salir del zen
    </button>
  )
}

function Workspace() {
  const [tab, setTab] = useState<ChecklistTab>('validation')
  const zen = useView((state) => state.zen)
  useShortcuts()

  return (
    <div className="flex h-full flex-col gap-2.5 p-2.5">
      {!zen && <TopBar />}
      <div className="flex min-h-0 flex-1 gap-2.5">
        {!zen && <Palette />}
        <main className="glass relative min-w-0 flex-1 overflow-hidden rounded-panel">
          <Canvas onOpenGuide={() => setTab('guide')} />
          {zen && <ZenExit />}
        </main>
        {!zen && (
          <aside className="glass flex h-full w-[21rem] shrink-0 flex-col overflow-hidden rounded-panel">
            <ChecklistPanel tab={tab} onTabChange={setTab} />
            <div className="max-h-[46%] shrink-0 overflow-y-auto border-t border-line">
              <PropertiesPanel />
            </div>
          </aside>
        )}
      </div>
      <Toasts />
    </div>
  )
}

export default function App() {
  const activeId = useLibrary((state) => state.activeId)

  if (!activeId) {
    return (
      <>
        <Home />
        <Toasts />
      </>
    )
  }

  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  )
}
