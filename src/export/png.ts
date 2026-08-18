/**
 * Rasterises an SVG string. The markup is self-contained (no external fonts,
 * images or stylesheets), so the canvas never becomes tainted and `toBlob`
 * works without a same-origin dance.
 */
export async function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('No se pudo rasterizar el SVG.'))
    element.src = source
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no expuso un contexto 2D.')
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.drawImage(image, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo generar el PNG.'))
    }, 'image/png')
  })
}
