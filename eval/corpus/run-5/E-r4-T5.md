---
kind: eval-artifact
run: 5
variant: E
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost them. Wrapping every prop function in `useCallback` stops almost no re-renders on its own, and it makes the code longer, slower to render, and easier to break.

Here is why it does nothing by default. A child re-renders whenever its parent re-renders, no matter what the props hold. Prop identity does not enter the picture. `useCallback` only starts to matter once the child is wrapped in `React.memo`, because `memo` is the thing that compares props and skips the render. Without `memo` on the child, a stable function reference changes nothing at all.

So the rule is: `useCallback` on the parent plus `React.memo` on the child, together, or neither.

Even paired, it breaks easily. `memo` does a shallow compare across every prop. One unstable prop defeats the whole comparison.

```jsx
<Row onClick={handleClick} style={{ margin: 8 }} items={data.filter(Boolean)} />
```

`handleClick` is memoized, and it does not help — the object literal and the fresh array are new every render, so `memo` bails out and the child renders anyway. Teams usually memoize the callback, see no improvement, and conclude memoization does not work.

And `useCallback` is not free. Every call allocates a dependency array, stores it, and compares it on each render. Doing that for hundreds of functions across a tree costs measurable time and buys nothing where the child is not memoized.

The dependency arrays carry real risk too. An omitted dependency gives you a callback closing over stale state, which produces bugs that reproduce only after a specific sequence of clicks. That is a much worse failure than an extra render.

What to do instead.

**Measure first.** Open the React Profiler, record the slow interaction, and look at what actually takes time. Most re-renders are cheap; React is fast at rendering. The problem is usually one expensive component, not a hundred cheap ones.

**Fix the cause, not the symptom.** Move state down so fewer components sit under it. Split a context that changes often from one that rarely changes. Pass children as props so a re-rendering parent does not force its subtree to re-render.

**Memoize narrowly.** Apply `useCallback`, `useMemo`, and `memo` to the specific boundary the profiler flagged, and confirm with a second recording that it helped.

One thing worth knowing: the React Compiler does this automatically and correctly, across the whole tree, without hand-written dependency arrays. If your project can adopt it, that is the version of your teammate's plan that actually works.
