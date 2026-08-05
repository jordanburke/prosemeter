/**
 * Constants shared between the page script and the worker.
 *
 * This module exists so neither side has to import a *value* from the other. Importing `MAX_CHARS`
 * from `scorer.worker.ts` pulled the whole worker module — and `prosemeter` with it — into the page
 * chunk, taking it from 6 KB to 315 KB and defeating the point of running the scorer off-thread.
 *
 * Exactly the mistake that put `node:fs` in prosemeter's root export: a value import where a type
 * import was intended. Cheap to make, invisible in review, obvious in the built output.
 */

/** A paste of a whole book would spin the worker for seconds. Score the head and say so. */
export const MAX_CHARS = 50_000

/** Trailing debounce on typing. Discrete intents (profile change, fixture load) skip it. */
export const DEBOUNCE_MS = 300
