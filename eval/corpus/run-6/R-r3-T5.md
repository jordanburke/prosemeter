---
kind: eval-artifact
run: 6
variant: R
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

No. On its own it does nothing, and it makes the code slower and harder to read.

## Why it does nothing

`useCallback` keeps a function identity stable between renders. That matters only when code downstream compares identities. A plain child component does not compare them. It re-renders every time its parent re-renders, whatever its props are.

```jsx
function Parent() {
  const handleClick = useCallback(() => doThing(), [])
  return <Child onClick={handleClick} />   // Child still re-renders
}
```

`Child` re-renders because `Parent` re-rendered. React does not check the props before re-rendering a child. It re-renders the tree.

For the memoization to bite, wrap the child in `React.memo`. That is the piece that compares props and bails out:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })
```

Now the stable identity matters. `React.memo` shallow-compares props and skips the render when they all match. `useCallback` without `React.memo` is a no-op with overhead.

## Why it costs you

`useCallback` is not free. Every call allocates the dependency array, stores it, and compares it against the previous one on each render. Then it hands back the same function you would have created without it. Creating a closure in JavaScript is cheap — cheaper than the bookkeeping that avoids creating it.

So the blanket policy trades a cheap allocation for a costlier allocation plus a comparison, a few hundred times a render. It also adds a dependency array to every callback, and the team now has to keep each one correct.

## Why it breaks even when the memo is there

The dependency arrays are the trap. Miss a dependency and the callback closes over stale state, which is a real bug and a hard one to find. Include an unstable dependency and the memoization stops working silently:

```jsx
const config = { mode: "edit" }                     // new object every render
const handle = useCallback(() => save(config), [config])  // new function every render
```

The `useCallback` is still there. It never returns the cached value, so `React.memo` sees a changed prop and re-renders. You now hold the cost and the complexity with none of the benefit. The code reads as optimized, so nobody re-checks it.

One unstable prop anywhere on the child does the same. Memoize the callback perfectly, pass `style={{ margin: 8 }}` alongside it, and the bail-out never fires.

## When it is worth it

Reach for `useCallback` when you can name the reason:

- The child sits inside `React.memo` **and** re-rendering it costs measurable time — a large list, a chart, a canvas, a heavy table.
- The function is a dependency of another hook, where an unstable identity re-fires an effect. People forget this case. It is a correctness fix, not a performance one.
- The function goes to a third-party component documented as identity-sensitive.

In each case you can point at the mechanism that reads the identity. Without that mechanism, no benefit exists to collect.

## What to do instead

Find out what is slow. Open the React DevTools Profiler, record an interaction, and read which components render and how long they take. A "too many re-renders" complaint usually resolves to one expensive component, not a thousand cheap ones. Cheap re-renders are fine. React is built for them.

Then fix the cause the profiler names. The structural fix beats the memoized one: move state down so fewer components sit under it, pass children as a prop so the expensive subtree skips the parent's re-render, or split the component so the frequently-changing part stays small.

## One more thing worth knowing

On React 19 with the React Compiler enabled, the compiler inserts memoization where it helps, and hand-written `useCallback` becomes redundant. Check what the project runs before spending an afternoon doing it by hand.

## The summary to give them

Blanket `useCallback` is a cost with no matching benefit unless the children sit inside `React.memo`. Even then it pays off only when those children are expensive. Profile first, memoize the one thing the profiler names, and leave the rest alone.
