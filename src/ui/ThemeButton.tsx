import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../store/theme'

/** Light/dark switch. Shared by the top bar and the home view. */
export default function ThemeButton() {
  const theme = useTheme((state) => state.theme)
  const toggle = useTheme((state) => state.toggle)
  const label = theme === 'dark' ? 'Pasar al tema claro' : 'Pasar al tema oscuro'

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-control text-ink transition hover:bg-accent-soft"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
