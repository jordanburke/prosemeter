---
kind: eval-artifact
run: 2
variant: G
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you. `useCallback` alone does nothing to stop a child from re-rendering. A normal child component re-renders whenever its parent does, no matter how stable its props are. React does not compare props before re-rendering unless you tell it to.

You need both halves:

1. The child wrapped in `React.memo`, which is what makes React compare props at all.
2. The callback wrapped in `useCallback`, which keeps the function reference the same so that comparison passes.

Miss either one and you get nothing. `useCallback` without `memo` is the common version of the mistake, and it is the one you are about to do everywhere.

Even with both, it often still fails. `memo` does a shallow compare, so any other prop that is a fresh object or array each render breaks it anyway. A single `style={{ margin: 8 }}` or `items={data.filter(...)}` in the JSX defeats the whole thing, and your stabilized callback did nothing.

And the cost is real, not theoretical. Every `useCallback` adds a dep array that React has to allocate and compare on each render, and it adds a line of code that can go stale when someone forgets to add a dep. You are paying that on every function to buy a saving on the few that matter.

What I would do instead:

- **Skip it by default.** Re-rendering is cheap. React re-renders a component and diffs the output; it does not touch the DOM unless something changed.
- **Measure first.** Open the React DevTools Profiler, record the interaction that feels slow, and look at what actually renders and how long it takes. Optimize what shows up there.
- **Reach for memo plus useCallback together, at the specific boundary that is slow.** Usually that is a big list, an expensive chart, or a tree with a lot of nodes below it.
- **Consider moving state down instead.** If the parent re-renders because of state only one small part needs, push that state into that part. That fixes the cause rather than blocking the symptom.

One exception worth keeping: if the function is a dependency of a `useEffect`, wrap it in `useCallback`. There the goal is not render performance, it is stopping the effect from re-firing on every render.
