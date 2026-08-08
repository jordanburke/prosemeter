---
kind: eval-artifact
run: 5
variant: A
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will make the code slower and harder to read. `useCallback` alone does not stop a child re-rendering. It only removes one of several reasons a child might re-render, and if the other reasons are still present it removes nothing.

## Why a stable function is not enough

By default, React re-renders a child whenever the parent re-renders. It does not compare props first. That comparison only happens if the child is wrapped in `React.memo`.

So the chain has two links:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })

const handleClick = useCallback(() => { ... }, [])
```

`React.memo` makes the child skip re-rendering when its props are shallowly equal. `useCallback` makes the function prop stay equal across renders so that check can actually pass. Without `memo`, the stable function changes nothing — the child re-renders regardless, and you have paid for the memoization with no benefit.

That is the core answer: `useCallback` without `React.memo` on the receiving component is dead code.

## The second thing that breaks it

Even with `memo` in place, every prop must be stable, not just the callbacks. One inline object undoes the whole arrangement:

```jsx
<Child onClick={handleClick} style={{ margin: 8 }} items={items.filter(Boolean)} />
```

`style` is a fresh object every render. `items` is a fresh array. The shallow comparison fails on those, the child re-renders, and the `useCallback` did nothing. Wrapping every function but leaving the objects inline is the most common way this effort produces zero measurable change.

Children are a prop too. `<Child>{something}</Child>` passes a new element object each render, which defeats `memo` the same way.

## What it costs

`useCallback` is not free. It allocates the dependency array, stores the function on the fiber, and runs a comparison on every render. For a callback that is cheap to recreate — which is nearly all of them — you are adding work to save nothing. The saving only appears when the child's render is expensive enough to outweigh that overhead.

The bigger cost is correctness risk. Every `useCallback` has a dependency array, and every dependency array is a place to capture a stale value. Applying it mechanically across a codebase multiplies the number of arrays a reviewer has to verify, and stale-closure bugs are considerably harder to find than a redundant render.

Readability is a real cost too. A file where every handler is wrapped reads as if all of them are performance-critical, which hides the two that actually are.

## When it does earn its place

Four cases justify it:

- The prop goes to a `React.memo` child whose render is genuinely expensive — a large list, a chart, a heavy table row.
- The function is a dependency of a `useEffect`. An unstable function there causes the effect to tear down and re-run every render, which can mean resubscribing to a socket on every keystroke. This is the case where instability is a bug, not a performance detail.
- The function is passed to a custom hook that treats it as a dependency, for the same reason.
- The value goes into a context provider, where an unstable value re-renders every consumer.

## What to do instead

Fix re-renders at the structural level first, because it usually beats memoization outright.

Move state down. If the state driving the re-render lives in a component that renders an expensive subtree, push the state into a smaller component that owns it. Nothing above needs to re-render.

Pass expensive subtrees as children. A component re-rendering does not re-render elements it received as props, so `<Layout>{<ExpensiveThing />}</Layout>` keeps `ExpensiveThing` untouched when `Layout`'s state changes. This gives you the win without `memo` or `useCallback` anywhere.

Measure before optimizing. The React DevTools Profiler shows which components re-render and how long each takes, with a "why did this render" reason per commit. Turn it on, do the interaction that feels slow, and look. Most re-renders cost microseconds and are not worth removing.

And consider the compiler. The React Compiler memoizes automatically and correctly, which makes hand-written `useCallback` largely obsolete. If adopting it is on the table, that is a better use of the effort than a sweep.

## Summary

Tell your teammate the sweep will not achieve the goal, because `useCallback` without `React.memo` prevents nothing and `React.memo` fails anyway if any other prop is recreated inline. Profile first, apply memoization to the few components where it measurably helps, and use `useCallback` unconditionally only where an unstable function causes a real bug — effect dependencies and context values.
