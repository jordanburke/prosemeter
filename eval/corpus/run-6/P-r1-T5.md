---
kind: eval-artifact
run: 6
variant: P
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will not work, and it will leave the code slower and harder to read. `useCallback` on its own stops no child from re-rendering. It removes one of several reasons a child re-renders, and if the other reasons remain it removes nothing.

## Why a stable function is not enough

React re-renders a child whenever the parent re-renders. It does not compare props first. That comparison happens only when the child is wrapped in `React.memo`.

The chain has two links:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })

const handleClick = useCallback(() => { ... }, [])
```

`React.memo` lets the child skip a render when its props are shallowly equal. `useCallback` keeps the function prop equal across renders so that check can pass. Without `memo`, the stable function changes nothing: the child re-renders anyway, and you paid for memoization with no return.

That is the core answer. `useCallback` without `React.memo` on the receiving component is dead code.

## The second thing that breaks it

Even with `memo` in place, every prop must be stable, not just the callbacks. One inline object undoes the arrangement:

```jsx
<Child onClick={handleClick} style={{ margin: 8 }} items={items.filter(Boolean)} />
```

`style` is a fresh object each render. `items` is a fresh array. The shallow comparison fails on those, the child re-renders, and the `useCallback` did nothing. Wrapping every function while leaving the objects inline is the most common way this effort produces no measurable change.

Children count as a prop too. `<Child>{something}</Child>` passes a new element object each render, which defeats `memo` the same way.

## What it costs

`useCallback` is not free. It allocates the dependency array, stores the function on the fiber, and runs a comparison every render. For a callback that is cheap to recreate — nearly all of them — you add work to save nothing. The saving appears only when the child's render is expensive enough to outweigh that overhead.

The larger cost is correctness risk. Every `useCallback` carries a dependency array, and every dependency array is a place to capture a stale value. Applying it across a codebase multiplies the arrays a reviewer must verify, and a stale-closure bug is much harder to find than a redundant render.

Readability costs too. A file where every handler is wrapped reads as if all of them are performance-critical, which hides the two that are.

## When it earns its place

Four cases justify it:

- The prop goes to a `React.memo` child whose render is genuinely expensive — a large list, a chart, a heavy table row.
- The function is a dependency of a `useEffect`. An unstable function there tears down and re-runs the effect every render, which can mean resubscribing to a socket on every keystroke. Here instability is a bug, not a performance detail.
- The function goes to a custom hook that treats it as a dependency, for the same reason.
- The value goes into a context provider, where an unstable value re-renders every consumer.

## What to do instead

Fix re-renders structurally first. That usually beats memoization outright.

**Move state down.** If the state driving the re-render sits in a component that renders an expensive subtree, push the state into a smaller component that owns it. Nothing above it re-renders.

**Pass expensive subtrees as children.** A re-rendering component does not re-render elements it received as props, so `<Layout>{<ExpensiveThing />}</Layout>` leaves `ExpensiveThing` untouched when `Layout`'s state changes. You get the win with no `memo` and no `useCallback` anywhere.

**Measure before optimizing.** The React DevTools Profiler shows which components re-render, how long each takes, and why each render happened. Turn it on, run the interaction that feels slow, and look. Most re-renders cost microseconds and are not worth removing.

**Consider the compiler.** The React Compiler memoizes automatically and correctly, which makes hand-written `useCallback` largely obsolete. If adopting it is on the table, that beats a manual sweep.

## Summary

Tell your teammate the sweep will not reach the goal. `useCallback` without `React.memo` prevents nothing, and `React.memo` fails anyway when any other prop is recreated inline. Profile first, memoize the few components where it measurably helps, and reach for `useCallback` unconditionally only where an unstable function causes a real bug — effect dependencies and context values.
