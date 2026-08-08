---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
On its own, no — wrapping the prop function in `useCallback` won't stop the child from re-rendering.

`useCallback` only keeps the *function's* reference stable across renders. React still re-renders a child whenever its parent re-renders, unless the child itself is wrapped in `React.memo`. Without that, a stable callback prop changes nothing — the child re-renders anyway because nothing is telling React to skip it.

Even with `React.memo` on the child, it only helps if *every* prop stays referentially stable. A memoized callback next to an inline object or array literal (`style={{ color: "red" }}`, `options={[1,2,3]}`) still breaks the comparison, because that literal gets a new reference every render regardless of what you did to the function.

And `useCallback` isn't free — it holds onto a closure and does a dependency check on every render. Wrapping every function "just in case" adds that cost everywhere for a benefit that only shows up in the specific case where the child is memoized and every other prop is stable too.

What actually works:

1. Wrap the child in `React.memo`.
2. Memoize the callbacks passed to *that* child with `useCallback`.
3. Memoize any object/array props passed alongside it with `useMemo`.
4. Get the dependency arrays right — a callback that depends on something changing every render defeats the memoization anyway.

Skip the blanket rule. Apply `useCallback` where you've confirmed a memoized child is actually re-rendering because of it — profile first, then fix the specific case.
