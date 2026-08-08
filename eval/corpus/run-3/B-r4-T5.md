---
kind: eval-artifact
run: 3
variant: B
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
On its own, no. `useCallback` gives you a stable function reference, but a plain child component re-renders whenever its parent does, regardless of whether its props changed. So you'd be adding the ceremony and getting none of the benefit.

For it to do anything, the child also has to be wrapped in `React.memo`. That's what makes React compare props and skip the re-render. `useCallback` only supplies the stable reference that makes the comparison come out equal.

And even with both in place, it's easy to defeat by accident. If any *other* prop is a fresh object or array each render, memo's comparison fails and the child re-renders anyway:

```jsx
// useCallback on onSelect does nothing here — style is a new object every render
<Row onSelect={handleSelect} style={{ padding: 8 }} />
```

The bigger question is whether this is worth doing at all. Re-rendering is not inherently expensive — React re-renders a component and diffs the output, and for most components that's sub-millisecond work. `useCallback` isn't free either: it allocates, it stores a dependency array, and it adds a line of code that has to stay correct. Applied everywhere, it's usually net-neutral on performance and net-negative on readability. It also tends to rot — someone adds a dependency, forgets the array, and now you have a stale closure bug, which is much harder to find than a slow render.

Where it genuinely pays off:

- The child is actually expensive — a big list, a chart, a heavy tree.
- The function is a dependency of another hook, where an unstable reference causes an effect to re-fire.
- You've profiled and found a specific component re-rendering too often in a hot path.

My suggestion: don't do it preemptively. Open the React DevTools Profiler, record the interaction that feels slow, and see what's actually costing time. Usually it's one or two components, not the whole tree.

Also worth mentioning — if the codebase is on React 19, the compiler handles most of this automatically, and hand-written `useCallback` becomes largely redundant.
