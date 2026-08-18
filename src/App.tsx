import { ReactFlowProvider } from '@xyflow/react'
import { useState } from 'react'
import Canvas from './canvas/Canvas'
import { useShortcuts } from './hooks/useShortcuts'
import ChecklistPanel, { type ChecklistTab } from './ui/ChecklistPanel'
import Palette from './ui/Palette'
import PropertiesPanel from './ui/PropertiesPanel'
import Toasts from './ui/Toasts'
import TopBar from './ui/TopBar'

function Workspace() {
  const [tab, setTab] = useState<ChecklistTab>('validation')
  useShortcuts()

  return (
    <div className="flex h-full flex-col gap-2.5 p-2.5">
      <TopBar />
      <div className="flex min-h-0 flex-1 gap-2.5">
        <Palette />
        <main className="glass min-w-0 flex-1 overflow-hidden rounded-panel">
          <Canvas onOpenGuide={() => setTab('guide')} />
        </main>
        <aside className="glass flex h-full w-[21rem] shrink-0 flex-col overflow-hidden rounded-panel">
          <ChecklistPanel tab={tab} onTabChange={setTab} />
          <div className="max-h-[46%] shrink-0 overflow-y-auto border-t border-line">
            <PropertiesPanel />
          </div>
        </aside>
      </div>
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  )
}
