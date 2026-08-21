/**
 * The agent's face, as numbers.
 *
 * Everything the character can do is a handful of scalars that are eased
 * towards a target every frame, so there is no such thing as a jump between
 * two states: reading turns into thinking turns into a grin the way a face
 * would, not the way a spinner swaps out for a checkmark. Shapes are generated
 * from those scalars rather than picked from a list of drawings, which is what
 * makes the in-between frames legible.
 *
 * The idea (one filled body that morphs, two eyes that morph independently,
 * exponential ease-outs and no overshoot, life carried by gaze and blinks) is
 * borrowed from jeremy-prt/bloub (MIT); the geometry here is our own.
 */

export type AgentMood = 'sleep' | 'scan' | 'think' | 'ok' | 'error' | 'idle'

export interface Pose {
  /** Body half-width and half-height, in a 100×100 viewBox centred on 50,50. */
  rx: number
  ry: number
  /** Superellipse exponent: 2 is an ellipse, 4 is nearly a rounded square. */
  squircle: number
  /** Body tilt, degrees. */
  tilt: number
  /** Eye half-width and half-height. */
  eyeW: number
  eyeH: number
  /**
   * How far both edges of the eye bow upwards. Past `eyeH` the lower edge
   * crosses the baseline and the eye becomes a crescent: that is the smile.
   * Negative bows the other way, which is the whole of the sad face.
   */
  curve: number
  /** Half the distance between the two eyes. */
  spread: number
  /** Eye pair offset from the body centre; negative is higher. */
  lift: number
  /** Eye lean off vertical, degrees. */
  lean: number
  /** Body gradient, top and bottom stop, as RGB triples. */
  from: readonly [number, number, number]
  to: readonly [number, number, number]
}

/**
 * One pose per state the canvas can actually be in. They are deliberately
 * close together: the character is recognisably the same creature in all six,
 * which is what lets a change of mood read as a change of mood.
 */
export const MOODS: Record<AgentMood, Pose> = {
  // Disconnected: settled, heavy, eyes shut.
  sleep: {
    rx: 36,
    ry: 28,
    squircle: 3.6,
    tilt: 0,
    eyeW: 10,
    eyeH: 1.2,
    curve: 3,
    spread: 17,
    lift: 3,
    lean: 0,
    from: [148, 163, 184],
    to: [100, 116, 139],
  },
  // Looking for the agent: alert, eyes wide and high.
  scan: {
    rx: 33,
    ry: 35,
    squircle: 3,
    tilt: -4,
    eyeW: 10.5,
    eyeH: 14,
    curve: 0,
    spread: 18,
    lift: -4,
    lean: 18,
    from: [251, 191, 36],
    to: [245, 158, 11],
  },
  // Working on the diagram: squat, leaning in, eyes narrowed on the task.
  think: {
    rx: 37,
    ry: 30,
    squircle: 3.8,
    tilt: 4,
    eyeW: 10,
    eyeH: 8,
    curve: 2,
    spread: 16,
    lift: -3,
    lean: 26,
    from: [96, 165, 250],
    to: [139, 92, 246],
  },
  // It landed.
  ok: {
    rx: 35,
    ry: 34,
    squircle: 3,
    tilt: 0,
    eyeW: 11,
    eyeH: 9,
    curve: 9,
    spread: 17.5,
    lift: -3,
    lean: 12,
    from: [52, 211, 153],
    to: [16, 163, 127],
  },
  // It did not: flattened, tipped over, eyes bowed the wrong way.
  error: {
    rx: 38,
    ry: 27,
    squircle: 3.4,
    tilt: -7,
    eyeW: 10,
    eyeH: 8.5,
    curve: -6.5,
    spread: 16.5,
    lift: 0,
    lean: 34,
    from: [248, 113, 113],
    to: [225, 71, 71],
  },
  // Connected, nothing happening. Gaze drift and blinks do the rest.
  idle: {
    rx: 34,
    ry: 33,
    squircle: 3.2,
    tilt: 0,
    eyeW: 9.5,
    eyeH: 12,
    curve: 0,
    spread: 17,
    lift: -2,
    lean: 26,
    from: [125, 211, 252],
    to: [79, 130, 246],
  },
}

/** Every numeric field, so the easing loop never has to name them one by one. */
const SCALARS = [
  'rx',
  'ry',
  'squircle',
  'tilt',
  'eyeW',
  'eyeH',
  'curve',
  'spread',
  'lift',
  'lean',
] as const

/**
 * Exponential ease-out, framerate independent: each field covers the same
 * fraction of its remaining distance per second whatever the frame took. It
 * never overshoots, so a mood can change mid-transition without the face
 * snapping or wobbling.
 */
export function approach(pose: Pose, target: Pose, dt: number, rate = 9): void {
  const k = 1 - Math.exp(-rate * dt)
  for (const key of SCALARS) pose[key] += (target[key] - pose[key]) * k
  pose.from = mixRgb(pose.from, target.from, k)
  pose.to = mixRgb(pose.to, target.to, k)
}

function mixRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  k: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ]
}

export function rgb(colour: readonly [number, number, number]): string {
  return `rgb(${Math.round(colour[0])} ${Math.round(colour[1])} ${Math.round(colour[2])})`
}

/** Enough samples that the outline reads as a curve at every size we draw at. */
const BODY_STEPS = 56

/**
 * Superellipse through the body's two radii. One exponent takes it from a
 * circle to a rounded square, which is the whole of the body's vocabulary:
 * calm is round, concentrating is squarer and wider.
 */
export function bodyPath(rx: number, ry: number, squircle: number): string {
  const power = 2 / Math.max(2, squircle)
  let path = ''
  for (let i = 0; i < BODY_STEPS; i += 1) {
    const angle = (i / BODY_STEPS) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const x = 50 + Math.sign(cos) * Math.abs(cos) ** power * rx
    const y = 50 + Math.sign(sin) * Math.abs(sin) ** power * ry
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return `${path}Z`
}

/**
 * One eye: two quadratic bows meeting at the corners. `curve` slides both bows
 * up together, so the same path is an open eye, a squint, a crescent smile and
 * a worried arc depending on one number.
 */
export function eyePath(w: number, h: number, curve: number): string {
  const half = Math.max(0.3, w)
  return (
    `M${-half} 0` +
    `Q0 ${(-h - curve).toFixed(2)} ${half} 0` +
    `Q0 ${(h - curve).toFixed(2)} ${-half} 0Z`
  )
}
