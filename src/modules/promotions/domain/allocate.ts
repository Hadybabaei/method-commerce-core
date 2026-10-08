/**
 * Splits a whole amount across weights in proportion, in whole units, so the
 * parts always add up to `total` exactly. Leftover units go to the parts with
 * the largest fractional remainder (ties: the larger weight, then the earlier one).
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0)
  if (total <= 0 || sum <= 0) {
    return weights.map(() => 0)
  }

  const exact = weights.map((weight) => (total * weight) / sum)
  const parts = exact.map(Math.floor)
  let left = total - parts.reduce((acc, part) => acc + part, 0)

  const order = exact
    .map((value, index) => ({
      index,
      remainder: value - Math.floor(value),
      weight: weights[index],
    }))
    .sort((a, b) => b.remainder - a.remainder || b.weight - a.weight || a.index - b.index)

  for (const { index } of order) {
    if (left === 0) break
    parts[index] += 1
    left -= 1
  }
  return parts
}
