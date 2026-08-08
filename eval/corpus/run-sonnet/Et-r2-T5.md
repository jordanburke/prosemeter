---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
On its own, no. `useCallback` stops the *function* from changing identity between renders, but that alone does not stop the child from re-rendering.

A child re-renders when its parent re-renders, unless the child is wrapped in `React.memo`. `React.memo` skips the re-render only if all props are equal — and a plain function prop is a new reference every render, which is why people reach for `useCallback` in the first place. But if the child isn't memoized, React re-renders it regardless of whether the prop reference changed. `useCallback` without `React.memo` on the receiving end does nothing for render count.

So the pattern needs two pieces, not one:

1. Wrap the child in `React.memo`.
2. Wrap the function prop in `useCallback`, with a correct dependency array.

A few other things to flag before they do this everywhere:

- **`useCallback` isn't free.** It adds a dependency check on every render. For cheap child components, the overhead of memoizing can cost more than the re-render it prevents.
- **Wrong dependencies cause stale closures.** An empty array locks in the first render's values — if the callback reads state or props, they'll list them or the callback goes stale.
- **Measure first.** Wrapping *every* function prop is a blanket fix for a problem that's usually localized to one or two heavy child components. Profile with React DevTools, find which components actually re-render expensively, and memoize those — not all of them.
