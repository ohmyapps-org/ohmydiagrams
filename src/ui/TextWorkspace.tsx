import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { exportMermaid } from '../export'
import { useDocument } from '../store/document'
import {
  describeFailure,
  MERMAID_EXAMPLES,
  renderMermaid,
  type MermaidResult,
} from '../text/mermaid'
import TextTopBar from './TextTopBar'
import Toasts from './Toasts'

const RENDER_DELAY_MS = 180

/**
 * Draws `source` after the typing pauses. Answers that arrive out of order are
 * dropped, so a slow first render never overwrites a fast second one.
 */
function useDrawing(source: string): MermaidResult | null {
  const [result, setResult] = useState<MermaidResult | null>(null)

  useEffect(() => {
    let current = true
    const timer = window.setTimeout(() => {
      void renderMermaid(source).then((next) => {
        if (current) setResult(next)
      })
    }, RENDER_DELAY_MS)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [source])

  return result
}

function Preview({ result }: { result: MermaidResult | null }) {
  // The last good drawing stays up while the text is mid-edit and invalid.
  const [lastGood, setLastGood] = useState<string | null>(null)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (result?.ok) setLastGood(result.svg)
    else if (result?.code === 'empty') setLastGood(null)
  }, [result])

  useEffect(() => {
    // pele escapes diagram text and filters links and styles, which is what
    // makes its output safe to inject.
    if (host.current) host.current.innerHTML = lastGood ?? ''
  }, [lastGood])

  const broken = result !== null && !result.ok && result.code !== 'empty'

  return (
    <div className="relative h-full w-full overflow-auto p-6">
      <div
        ref={host}
        className={`pele-host mx-auto w-fit max-w-full transition-opacity ${
          broken ? 'opacity-40' : ''
        }`}
        data-testid="mermaid-preview"
      />
      {lastGood === null && (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] text-muted">
          {broken
            ? 'Todavía no hay nada que dibujar: corregí el texto.'
            : 'Escribí un diagrama Mermaid a la izquierda y se dibuja acá.'}
        </p>
      )}
    </div>
  )
}

export default function TextWorkspace() {
  const source = useDocument((state) => state.source)
  const setSource = useDocument((state) => state.setSource)
  const result = useDrawing(source)
  const failure = result && !result.ok && result.code !== 'empty' ? result : null

  return (
    <div className="flex h-full flex-col gap-2.5 p-2.5">
      <TextTopBar />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:flex-row">
        <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel md:max-w-[34rem]">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3 text-[11px] text-faint">
            <span className="font-medium uppercase tracking-wide">Mermaid</span>
            {result?.ok && <span>{result.type}</span>}
          </div>
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                event.preventDefault()
                exportMermaid()
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Texto del diagrama en Mermaid"
            placeholder="flowchart LR&#10;  A[Mermaid] --> B[SVG]"
            className="min-h-0 w-full flex-1 resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
          {source.trim() === '' && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-line px-3 py-2">
              <span className="text-[11px] text-faint">Empezar desde:</span>
              {MERMAID_EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => setSource(example.source)}
                  className="rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink transition hover:border-accent hover:text-accent"
                >
                  {example.label}
                </button>
              ))}
            </div>
          )}
          {failure && (
            <div
              role="alert"
              className="flex shrink-0 items-start gap-2 border-t border-line bg-danger-soft px-3 py-2 text-[12px] leading-snug text-danger"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 whitespace-pre-wrap break-words">
                {describeFailure(failure)}
              </span>
            </div>
          )}
        </section>
        <main className="canvas-panel relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-panel">
          <Preview result={result} />
        </main>
      </div>
      <Toasts />
    </div>
  )
}
