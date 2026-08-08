---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you readability for nothing.

`useCallback` only helps if the child is wrapped in `React.memo`. A plain child re-renders whenever its parent does, no matter how stable its props are. So wrapping every handler in `useCallback` while the children are unmemoized changes nothing except adding a dependency array to maintain.

Even with `React.memo` on the child, one unstable prop breaks it. Pass a stable `onClick` but an inline `style={{ color: "red" }}` or `items={data.filter(...)}` and the memo comparison fails anyway. You have to stabilize *all* the props, not just the functions.

And `useCallback` is not free. It allocates the dependency array, runs a comparison every render, and keeps the old closure alive. For a handler passed to a `<button>`, that costs more than the re-render it is meant to prevent.

What I would do instead:

- **Measure first.** Open the React DevTools Profiler and find out which components actually take time. Usually it is one expensive subtree, not the whole page.
- **Memoize that subtree**, and stabilize the props it needs — the callbacks *and* the objects.
- **Move state down** where you can. A component that re-renders is often just holding state its parent does not need.

The blanket approach treats re-rendering as the bug. Re-rendering is normal and usually cheap. Slow renders are the bug.
