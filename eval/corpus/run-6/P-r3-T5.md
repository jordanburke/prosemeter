---
kind: eval-artifact
run: 6
variant: P
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

No. On its own it does nothing at all, and it makes the code slower and harder to read.

## Why it does nothing

`useCallback` keeps a function identity stable between renders. That matters only if something downstream compares identities. A plain child component does not. It re-renders whenever its parent re-renders, whatever its props say.

```jsx
function Parent() {
  const handleClick = useCallback(() => doThing(), [])
  return <Child onClick={handleClick} />   // Child still re-renders
}
```

`Child` re-renders because `Parent` re-rendered. React does not check whether props changed before re-rendering a child. It re-renders the tree.

For the memoization to bite, the child has to be wrapped in `React.memo`, which is the thing that compares props and bails out:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })
```

Now the stable identity matters, because `React.memo` shallow-compares props and skips the render when they all match. `useCallback` without `React.memo` is a no-op with overhead.

## Why it costs something

`useCallback` is not free. Every call allocates the dependency array, stores it, and compares it against the previous one on each render. Then it usually hands back the same function you would have created anyway. Creating a closure in JavaScript is cheap — in most cases cheaper than the bookkeeping needed to avoid creating it.

So the blanket policy trades a cheap allocation for a slightly less cheap allocation plus a comparison, several hundred times a render. It also adds a dependency array to every callback that somebody now has to keep correct.

## Why it often breaks even when the memo is there

The dependency arrays are the trap. Miss a dependency and the callback closes over stale state, which is a real bug and a hard one to find. Include an unstable dependency and the memoization quietly stops working:

```jsx
const config = { mode: "edit" }                     // new object every render
const handle = useCallback(() => save(config), [config])  // new function every render
```

The `useCallback` is still there. It just never returns the cached value, so `React.memo` sees a changed prop and re-renders anyway. You now have the cost, the complexity, and none of the benefit — and it looks optimized, so nobody re-checks it.

One unstable prop anywhere on the child does the same. Memoize the callback perfectly, then pass `style={{ margin: 8 }}` alongside it, and the bail-out never fires.

## When it is genuinely worth it

Reach for `useCallback` when you can name the reason:

- The child is wrapped in `React.memo` **and** re-rendering it is measurably expensive — a large list, a chart, a canvas, a heavy table.
- The function is a dependency of another hook, where an unstable identity re-fires an effect. People forget this case, and it is a correctness fix, not a performance one.
- The function goes to a third-party component documented as identity-sensitive.

In each of those you can point at the mechanism that reads the identity. If you cannot point at one, there is no benefit to collect.

## What to do instead

Find out what is actually slow. Open the React DevTools Profiler, record an interaction, and look at which components render and how long they take. Most "too many re-renders" complaints turn out to be one expensive component, not thousands of cheap ones. Cheap re-renders are fine — React is built for them.

Then fix the specific cause. The better fix is often structural rather than memoized: move state down so fewer components sit under it, pass children as a prop so the expensive subtree does not re-render with the parent, or split the component so the fast-changing part is small.

## One more thing worth knowing

On React 19 with the React Compiler enabled, memoization gets inserted automatically where it helps, and hand-written `useCallback` becomes redundant. Check what the project runs before anyone spends an afternoon doing it by hand.

## The summary to give them

Blanket `useCallback` is a cost with no matching benefit unless the children are wrapped in `React.memo`, and even then it pays off only when those children are expensive. Profile first, memoize the specific thing the profiler names, and leave the rest alone.
