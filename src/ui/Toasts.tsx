import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useToasts, type ToastTone } from '../store/toasts'

const ICONS: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
}

const COLORS: Record<ToastTone, string> = {
  info: 'text-accent',
  success: 'text-ok',
  error: 'text-danger',
}

export default function Toasts() {
  const toasts = useToasts((state) => state.toasts)
  const dismiss = useToasts((state) => state.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((item) => {
        const Icon = ICONS[item.tone]
        return (
          <div
            key={item.id}
            role="status"
            className="glass pointer-events-auto flex max-w-md items-start gap-2.5 rounded-panel px-3.5 py-2.5"
          >
            <Icon size={16} className={`mt-0.5 shrink-0 ${COLORS[item.tone]}`} />
            <p className="text-[12.5px] leading-snug text-ink">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Cerrar aviso"
              className="-mr-1 shrink-0 rounded p-0.5 text-faint transition hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
