---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, wrapping the functions alone won't stop the re-renders. `useCallback` only fixes half the problem.

Here's why: `useCallback` gives you a stable reference for the function itself. But the child component still re-renders when its parent re-renders, unless the child is also wrapped in `React.memo`. Without that, React re-renders the child regardless of whether its props changed — a stable function reference doesn't matter if nothing checks it.

So you need both pieces:

1. `useCallback` on the parent, so the function prop keeps the same reference across renders.
2. `React.memo` on the child, so it skips re-rendering when props are referentially equal.

One more trap: `useCallback` only helps if every other prop the child receives is also stable. Pass a new object or array literal alongside the callback — `{ ...options }` inline in JSX, for example — and the child re-renders anyway, because that prop changes identity every time.

Before reaching for either tool, check whether the re-renders are actually a performance problem. React re-rendering a component is cheap; `useCallback` and `React.memo` both cost a little memory and comparison overhead. Wrapping every function "just in case" adds complexity without a measured benefit. Profile with React DevTools first, then memoize the components that are actually slow.
