---
kind: eval-artifact
run: 2
variant: E
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work on its own. `useCallback` stabilizes the function's identity, but a stable prop only prevents a re-render if the child is wrapped in `React.memo`. Without `memo`, the child re-renders whenever the parent does, no matter how stable the props are.

So the pattern needs both halves:

```tsx
const handleClick = useCallback(() => save(id), [id])
// and
const Child = React.memo(function Child({ onClick }) { ... })
```

Miss either one and you get nothing.

Even with both, it often still fails, because `memo` does a shallow compare of *all* props. One unstable prop defeats it. An inline `style={{ margin: 4 }}`, an inline `items={[a, b]}`, or `children` as JSX is a new reference every render, so the memo check fails and the child renders anyway. The `useCallback` was wasted work.

And `useCallback` is not free. Each one allocates a dependency array, compares it every render, and holds the old closure alive. Applied to every prop across a codebase, that is real cost paid up front for a benefit that usually never arrives.

The bigger point: re-rendering is not the problem. Re-rendering is cheap. Expensive rendering is the problem. A component that returns a few divs can render thousands of times a second and no one notices.

So my advice is to skip the blanket rule and reach for `memo` plus `useCallback` only where you have measured a cost — a long list, a heavy chart, a subtree that runs real computation. Open the React Profiler, record the interaction, and look at what actually takes time. Optimize that.

One more thing worth knowing: if you are on React 19 with the compiler enabled, it inserts this memoization for you and hand-written `useCallback` becomes mostly redundant. Worth checking the build config before anyone spends a day on this.
