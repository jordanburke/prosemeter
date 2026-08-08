---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
On its own, no — `useCallback` alone won't stop the re-renders.

Here's why. `useCallback` keeps the *function reference* stable across renders. But the child still re-renders whenever the parent re-renders, unless the child itself is wrapped in `React.memo`. Without that wrapper, React re-renders the child every time regardless of whether its props changed, so a stable function reference buys nothing.

Two more things trip people up even after adding `React.memo`:

- **Every other prop must also stay stable.** If you pass a new object or array literal each render (`style={{ color: 'red' }}`, `items={[1, 2, 3]}`), `React.memo`'s shallow comparison sees a new prop and re-renders anyway. The callback being stable doesn't help if a sibling prop isn't.
- **`useCallback` has its own cost.** It runs on every render to check dependencies, and holds a reference in memory. Wrapping every function "just in case" adds overhead across the whole component tree for renders that were never expensive to begin with.

My advice: measure first. Use the React DevTools Profiler to find which children actually re-render expensively. Wrap only those in `React.memo`, then stabilize the specific props feeding them (functions with `useCallback`, objects/arrays with `useMemo`). Wrapping everything is extra code that mostly does nothing.
