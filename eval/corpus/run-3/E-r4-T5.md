---
kind: eval-artifact
run: 3
variant: E
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That will not work on its own. `useCallback` stabilizes the function's identity, but the child still re-renders unless you also wrap it in `React.memo`. Without `memo`, a child re-renders whenever its parent does, no matter how stable the props are.

So the pattern needs both halves:

```js
const Child = React.memo(function Child({ onSelect }) { ... })

const onSelect = useCallback((id) => select(id), [])
```

Skip either piece and you get nothing back.

Even with both, watch for the things that quietly undo it:

- **Any other unstable prop breaks it.** `memo` compares every prop shallowly, so one inline `style={{...}}` or `items={[...]}` defeats the whole thing.
- **Unstable deps inside the callback** make it change anyway. `useCallback` with a dep that changes every render just adds bookkeeping.
- **Context changes bypass `memo` entirely.** A child reading a context re-renders when that context value changes.

The bigger point: wrapping *every* prop function costs you something. Each `useCallback` allocates a dep array and runs a comparison on every render, and it makes the code harder to read. That cost is small, and so is the payoff on a component that renders fast anyway.

Reach for this when you have measured a problem. Open the React DevTools Profiler, find the components that actually take time, and fix those. React Compiler handles this automatically if you can adopt it, which makes the whole debate moot.
