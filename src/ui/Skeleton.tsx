import type { CSSProperties, ReactNode } from 'react'

interface Props {
  /** Tailwind sizing for this bar; height defaults to a line of text. */
  className?: string
  style?: CSSProperties
}

/**
 * A placeholder in the shape of the content that is loading. Purely decorative:
 * the surrounding block is what announces the wait to a screen reader.
 */
export default function Skeleton({ className = 'h-3 w-full', style }: Props) {
  return <span aria-hidden className={`skeleton block ${className}`} style={style} />
}

/**
 * Wraps a group of placeholders with the live-region plumbing, so the wait is
 * announced once instead of once per bar.
 */
export function SkeletonBlock({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  )
}
