---
kind: eval-artifact
run: 2
variant: Ep
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That will not stop the re-renders on its own. `useCallback` keeps the function's identity stable across renders. The child still re-renders anyway, because a parent re-render re-renders its children regardless of whether the props changed.

Stable props only matter to a child wrapped in `React.memo`. `memo` is the part that compares props and skips the render. `useCallback` exists to keep that comparison from failing on a function that would otherwise be new every time. Without `memo` on the child, nothing reads the comparison, so the callback is pure overhead — an extra allocation and a dependency check on every render.

Even with `memo`, one unstable prop defeats the whole thing. If you pass `style={{ margin: 8 }}` or `items={data.filter(...)}` alongside the memoized callback, that object is new each render, the comparison fails, and the child renders. You have to stabilize every prop or none of it counts.

What I would actually do:

1. **Profile first.** Open the React DevTools Profiler and find which components are slow. Most re-renders cost microseconds and are invisible to users.
2. **Memoize the expensive child**, not the callback. Wrap it in `React.memo`, then stabilize whatever props it takes — including the callback.
3. **Move state down instead**, where you can. If the state driving the re-render lives closer to the component that uses it, the expensive subtree never re-renders and you need neither hook.

One case is worth doing without profiling: `useCallback` on a function that sits in another effect's dependency array. There the stable identity controls whether the effect re-runs, which is correctness, not speed.

Worth knowing: the React Compiler does this memoization automatically and better than hand-written hooks. If you are on React 19 and can turn it on, that beats adding hooks by hand.
