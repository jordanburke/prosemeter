---
kind: eval-artifact
run: 3
variant: E
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, that won't stop the re-renders. `useCallback` only helps when the child is wrapped in `React.memo`, and most children aren't.

Here's the mechanism. A plain child component re-renders whenever its parent re-renders, full stop. React doesn't compare props to decide. So a stable function reference changes nothing — the child was never looking at it.

`React.memo` is what makes the child compare its props and skip the render. Only then does a stable callback matter. The two work as a pair:

```tsx
const Child = React.memo(function Child({ onSave }) { ... })

// now this useCallback does something
const onSave = useCallback(() => save(id), [id])
```

Without the `memo`, the `useCallback` is pure cost. It allocates the dependency array, runs the comparison, and holds the old closure alive — every render, forever, for zero benefit.

**Two more ways it silently does nothing**, even with `memo` in place:

1. **An unstable dep.** If a dep is an object or array built inline, the callback identity changes anyway and `memo` bails out. You've moved the problem, not solved it.
2. **Another unstable prop.** `memo` compares all props. One inline object (`style={{...}}`) or one inline arrow next to your memoized callback breaks the comparison and the child re-renders regardless.

**What I'd do instead.** Profile first with the React DevTools Profiler and find which components are actually expensive. Re-rendering a component that returns twenty DOM nodes costs nothing measurable — optimizing it is wasted effort and permanent code noise.

When you find a real hotspot, the cheaper fixes usually beat memoization:

- Move state down so fewer components sit under it.
- Pass children as a `children` prop, so the parent's re-render doesn't recreate the subtree.
- Split the context, so consumers don't wake for changes they ignore.

And if you're on React 19 with the compiler enabled, it inserts this memoization for you, correctly. Hand-written `useCallback` there is strictly redundant.
