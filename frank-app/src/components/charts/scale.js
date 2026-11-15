// Value-axis helpers shared by every chart.

const STEPS = [1, 2, 2.5, 5, 10]

/** 0 … a clean top ≥ max, at most ~8 ticks. A zero/negative max still gets a usable axis. */
export function niceTicks(max, maxTicks = 8) {
  if (!(max > 0)) return [0, 1000]
  const rough = max / (maxTicks - 1)
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = STEPS.map((s) => s * pow).find((s) => s >= rough)
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v))
  return ticks
}

const trim = (n) => String(Number(n.toFixed(1)))

/** Axis label in rand: R 0, R 50k, R 2.5k, R 1.5M. */
export function randTick(v) {
  if (v >= 1_000_000) return `R ${trim(v / 1_000_000)}M`
  if (v >= 1000) return `R ${trim(v / 1000)}k`
  return `R ${v}`
}
