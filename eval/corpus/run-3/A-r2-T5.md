---
kind: eval-artifact
run: 3
variant: A
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and it'll cost you readability and a bit of memory to find that out.

The thing to know: `useCallback` only helps if the child is actually skipping re-renders in the first place. A plain function component re-renders whenever its parent re-renders, full stop — it doesn't compare props at all. So a stable callback identity changes nothing, because nothing was checking it.

The child has to be wrapped in `React.memo` for prop identity to matter:

```tsx
const Child = React.memo(function Child({ onClick }: Props) { ... })
```

*Then* `useCallback` on the handler is doing real work — `memo` does a shallow compare, sees the same function reference, and bails out of the render.

And even with `memo`, one unstable prop defeats the whole thing. If you carefully `useCallback` the handler but pass `style={{ margin: 8 }}` or `items={data.filter(...)}` right next to it, the shallow compare fails on that prop and the child re-renders anyway. Your `useCallback` is now pure overhead: an extra allocation, a deps array to keep correct, and one more thing that goes subtly wrong when someone forgets to add a dependency.

There's also a cost people underestimate — `useCallback` isn't free. It allocates the array, stores the closure, and runs a comparison on every render. For a handler on a leaf `<button>`, you're paying that to save nothing.

Where I'd actually reach for it:

- The child is `React.memo`'d **and** its render is genuinely expensive (a big list, a chart, an editor).
- The function goes into a `useEffect` dependency array — there it's about correctness, not perf, since an unstable reference makes the effect re-fire.
- You're passing it to a deeply-memoized subtree via context.

Better first move than blanket-wrapping: find out what's actually re-rendering and whether it costs anything. React DevTools Profiler with "highlight updates" on will tell you in a couple of minutes. Usually the answer is that the re-renders are cheap and irrelevant, and the real problem is one component doing too much work, or state living higher in the tree than it needs to. Moving state down is often the fix that a hundred `useCallback`s were trying to approximate.

Worth mentioning: if you're on React 19 with the compiler enabled, it does this memoization automatically and hand-written `useCallback` is largely redundant. Check what version you're on before investing in the manual version.
