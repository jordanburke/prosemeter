---
kind: eval-artifact
run: 5
variant: A
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No. On its own it will do nothing at all, and it will make the code slower and harder to read.

## Why it does nothing

`useCallback` keeps a function identity stable between renders. That only matters if something downstream compares identities. A plain child component does not — it re-renders whenever its parent re-renders, no matter what its props are.

```jsx
function Parent() {
  const handleClick = useCallback(() => doThing(), [])
  return <Child onClick={handleClick} />   // Child still re-renders
}
```

`Child` re-renders because `Parent` re-rendered. React does not check whether the props changed before re-rendering a child. It just re-renders the tree.

For the memoization to bite, the child has to be wrapped in `React.memo`, which is the thing that actually compares props and bails out:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })
```

Now the stable identity matters, because `React.memo` shallow-compares props and skips the render when they all match. `useCallback` without `React.memo` is a no-op with overhead.

## Why it costs something

`useCallback` is not free. Every call allocates the dependency array, stores it, and compares it against the previous one on each render. Then it usually returns the same function you would have created anyway. Creating a closure in JavaScript is cheap — cheaper, in most cases, than the bookkeeping to avoid creating it.

So the blanket policy trades a cheap allocation for a slightly less cheap allocation plus a comparison, several hundred times a render, and adds a dependency array to every callback that someone now has to keep correct.

## Why it often breaks even when the memo is there

The dependency arrays are the trap. Miss a dependency and the callback closes over stale state, which is a real bug and a hard one to find. Include an unstable dependency and the memoization silently stops working:

```jsx
const config = { mode: "edit" }                     // new object every render
const handle = useCallback(() => save(config), [config])  // new function every render
```

The `useCallback` is still there. It just never returns the cached value, so `React.memo` sees a changed prop and re-renders anyway. Now you have the cost, the complexity, and none of the benefit — and it looks optimized, so nobody re-checks it.

The same happens with one unstable prop anywhere on the child. Memoize the callback perfectly, then pass `style={{ margin: 8 }}` alongside it, and the bail-out never fires.

## When it is genuinely worth it

Reach for `useCallback` when you can name the reason:

- The child is wrapped in `React.memo` **and** re-rendering it is measurably expensive — a large list, a chart, a canvas, a heavy table.
- The function is a dependency of another hook, where an unstable identity causes an effect to re-fire. This is the case people forget, and it is a correctness fix, not a performance one.
- The function goes to a third-party component documented as identity-sensitive.

In each of those you can point at the mechanism that reads the identity. If you cannot, there is no benefit to collect.

## What to do instead

Find out what is actually slow. Open the React DevTools Profiler, record an interaction, and look at which components render and how long they take. Most "too many re-renders" complaints turn out to be one expensive component, not thousands of cheap ones — and cheap re-renders are fine. React is built for them.

Then fix the specific cause. Often the better fix is structural rather than memoized: move state down so fewer components sit under it, pass children as a prop so the expensive subtree does not re-render with the parent, or split the component so the frequently-changing part is small.

## One more thing worth knowing

If you are on React 19 with the React Compiler enabled, it inserts memoization automatically where it helps, and hand-written `useCallback` becomes redundant. Check what the project is on before investing an afternoon in doing it by hand.

## The summary to give them

Blanket `useCallback` is a cost with no matching benefit unless the children are wrapped in `React.memo`, and even then it only pays off when those children are expensive. Profile first, memoize the specific thing the profiler names, and leave the rest alone.
