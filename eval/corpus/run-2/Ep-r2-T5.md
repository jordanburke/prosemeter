---
kind: eval-artifact
run: 2
variant: Ep
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, at least not on its own. `useCallback` alone stops nothing, because a plain child re-renders whenever its parent re-renders — no matter how stable its props are.

React does not compare props by default. When a parent re-renders, it re-renders its whole subtree. Giving the child an identical function reference changes nothing, because nothing is checking the reference.

`useCallback` only matters when something downstream actually compares. That means one of:

- The child is wrapped in `React.memo`, which shallow-compares props and bails out when they are equal.
- The function is a dependency of a `useEffect` or `useMemo` in the child, where an unstable reference causes the effect to re-run.
- The function goes into a context value or a custom hook that other memoized things depend on.

Without one of those, `useCallback` is pure cost. It is not free — it allocates the dependency array, stores the callback, and runs a comparison on every render. Wrapping every prop function means paying that everywhere and getting nothing back.

There is a sharper failure too. `useCallback` + `React.memo` still breaks the moment any *other* prop is unstable. Pass `style={{ margin: 4 }}` or `items={data.filter(...)}` alongside the memoized callback and the shallow compare fails every render anyway. Memoizing one prop out of five buys nothing.

**What I would do instead.** Profile first — open the React DevTools Profiler, record an interaction, and look at what actually re-renders and how long it takes. Most re-renders are cheap and invisible; a component that renders in 0.2ms does not need protecting. Then, for the components that genuinely are expensive, apply `React.memo` plus `useCallback` plus stable references for *every* prop, deliberately, as a unit.

Often the better fix is structural: move state down so fewer components sit below it, or pass children as a prop so the expensive subtree is created by the grandparent and skipped on the parent's re-render. Those cost nothing to maintain and do not silently stop working when someone adds a sixth prop.
