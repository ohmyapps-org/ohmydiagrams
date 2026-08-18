import { markerDefs } from '../uml/style'

/**
 * Single mount point for every arrowhead the canvas uses. React Flow renders
 * edges into one shared SVG, so the markers only need to exist once in the DOM.
 */
export default function Markers() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute h-0 w-0"
      dangerouslySetInnerHTML={{ __html: `<defs>${markerDefs()}</defs>` }}
    />
  )
}
