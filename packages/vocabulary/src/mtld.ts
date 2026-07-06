/**
 * MTLD (Measure of Textual Lexical Diversity), McCarthy & Jarvis 2010. Length-robust lexical
 * diversity: the mean number of tokens a running type-token ratio stays above a 0.72 factor before
 * "resetting". Computed forward and backward and averaged. No maintained npm package exists, so this
 * is a small in-house implementation.
 */

const FACTOR_THRESHOLD = 0.72

const mtldPass = (tokens: ReadonlyArray<string>): number => {
  let factors = 0
  let types = new Set<string>()
  let count = 0
  for (const token of tokens) {
    count += 1
    types.add(token)
    const ttr = types.size / count
    if (ttr <= FACTOR_THRESHOLD) {
      factors += 1
      count = 0
      types = new Set<string>()
    }
  }
  if (count > 0) {
    const ttr = types.size / count
    factors += (1 - ttr) / (1 - FACTOR_THRESHOLD)
  }
  return factors === 0 ? tokens.length : tokens.length / factors
}

/** MTLD over lower-cased tokens; the mean of the forward and backward passes. */
export const mtld = (tokens: ReadonlyArray<string>): number => {
  if (tokens.length === 0) return 0
  const forward = mtldPass(tokens)
  const backward = mtldPass([...tokens].reverse())
  return (forward + backward) / 2
}
