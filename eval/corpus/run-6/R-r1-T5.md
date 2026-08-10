---
kind: eval-artifact
run: 6
variant: R
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will not work. It will also make the code slower and harder to read. `useCallback` alone does not stop a child re-rendering. It removes one reason out of many, and the other reasons stay.

## Why a stable function is not enough

React re-renders a child every time the parent re-renders. It does not compare props first. That comparison happens only when the child is wrapped in `React.memo`.

So the chain has two links:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })

const handleClick = useCallback(() => { ... }, [])
```

`React.memo` makes the child skip re-rendering when its props are shallowly equal. `useCallback` keeps the function prop equal across renders, so that check can pass. Without `memo`, the stable function changes nothing. The child re-renders anyway, and you paid for memoization with no return.

That is the core answer. `useCallback` without `React.memo` on the receiving component is dead code.

## The second thing that breaks it

Even with `memo` in place, every prop must be stable — not the callbacks alone. One inline object undoes the whole arrangement:

```jsx
<Child onClick={handleClick} style={{ margin: 8 }} items={items.filter(Boolean)} />
```

`style` is a fresh object every render. `items` is a fresh array. The shallow comparison fails on those. The child re-renders, and the `useCallback` did nothing. Wrapping every function while leaving the objects inline is the most common way this effort produces no measurable change.

Children are a prop too. `<Child>{content}</Child>` passes a new element object each render, which defeats `memo` the same way.

## What it costs

`useCallback` is not free. It allocates the dependency array, stores the function on the fiber, and runs a comparison on every render. Nearly every callback is cheap to recreate. For those, you add work and save nothing. The saving appears only when the child's render costs more than that overhead.

The bigger cost is correctness risk. Every `useCallback` has a dependency array, and every dependency array can capture a stale value. Apply it mechanically across a codebase and you multiply the arrays a reviewer must verify. Stale-closure bugs are far harder to find than a redundant render.

Readability is a real cost too. A file where every handler is wrapped reads as if all of them are performance-critical. That hides the two that are.

## When it does earn its place

Four cases justify it:

- The prop goes to a `React.memo` child whose render is expensive — a large list, a chart, a heavy table row.
- The function is a dependency of a `useEffect`. An unstable function there tears down and re-runs the effect every render. That can mean resubscribing to a socket on every keystroke. Here instability is a bug, not a performance detail.
- The function is passed to a custom hook that treats it as a dependency, for the same reason.
- The value goes into a context provider, where an unstable value re-renders every consumer.

## What to do instead

Fix re-renders at the structural level first. Structure beats memoization outright.

Move state down. If the state driving the re-render lives in a component that renders an expensive subtree, push the state into a smaller component that owns it. Nothing above it re-renders.

Pass expensive subtrees as children. A re-rendering component does not re-render elements it received as props. `<Layout>{<ExpensiveThing />}</Layout>` leaves `ExpensiveThing` untouched when `Layout`'s state changes. You get the win with no `memo` and no `useCallback` anywhere.

Measure before optimizing. The React DevTools Profiler shows which components re-render and how long each takes, with a "why did this render" reason per commit. Turn it on, do the interaction that feels slow, and look. Re-renders that cost microseconds are not worth removing, and that describes most of them.

Look at the compiler. The React Compiler memoizes automatically and correctly, which makes hand-written `useCallback` obsolete in most files. If adopting it is on the table, spend the effort there instead of on a sweep.

## Summary

Tell your teammate the sweep will not reach the goal. `useCallback` without `React.memo` prevents nothing, and `React.memo` fails when any other prop is recreated inline. Profile first. Apply memoization to the components where it measurably helps. Reach for `useCallback` unconditionally only where an unstable function causes a real bug — effect dependencies and context values.
