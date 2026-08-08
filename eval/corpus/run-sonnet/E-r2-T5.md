---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, not by itself. `useCallback` alone won't stop child re-renders.

Here's why: `useCallback` keeps the *function reference* stable across renders. But the child still re-renders unless the child itself is wrapped in `React.memo`. Without `memo`, the child re-renders whenever the parent re-renders, no matter how stable the props are.

So the fix needs both pieces:

1. `useCallback` on the parent, so the function prop keeps the same reference between renders.
2. `React.memo` on the child, so it skips re-rendering when props haven't changed.

Miss either one and you get no benefit — with `memo` but no `useCallback`, the function prop is a new reference every render and `memo`'s shallow comparison fails anyway. With `useCallback` but no `memo`, the child re-renders regardless because it never checks props.

**One more catch:** wrapping *every* function in `useCallback` has a cost — the dependency array, the memoization bookkeeping — and it's wasted effort for components that aren't memoized or that re-render cheaply. Reach for this pair only where a profiler shows the re-render is actually expensive. Don't apply it as a blanket rule across the codebase.
