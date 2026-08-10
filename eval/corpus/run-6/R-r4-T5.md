---
kind: eval-artifact
run: 6
variant: R
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will not work, and it will cost something. `useCallback` alone stops nothing. The child re-renders regardless.

## Why the child still re-renders

React re-renders a child every time its parent re-renders. That is the default, and props have nothing to do with it. Change no props at all and the child still re-renders.

`useCallback` only makes the function reference stable between renders. Stability matters solely to code that *compares* props. By default nothing compares props.

So the sequence is:

1. Parent re-renders.
2. React re-renders every child in its tree.
3. Nobody consults the stable callback, because nobody compared.

## What it takes to skip the child

Two pieces, and you need both:

```jsx
const Child = React.memo(function Child({ onSave }) { /* ... */ })

// in the parent
const handleSave = useCallback(() => save(id), [id])
```

`React.memo` does the skipping. It shallow-compares props and bails out of the re-render when they all match. `useCallback` lets the function prop pass that comparison.

Without `memo`, `useCallback` is pure overhead. Without `useCallback`, `memo` fails on the first inline function you pass. Your teammate proposes installing half the mechanism everywhere.

## The other half that breaks it silently

Even with both, one unstable prop defeats the whole thing. `memo` compares *all* props. Each of these is new on every render:

```jsx
<Child
  onSave={handleSave}        // stable, good
  style={{ margin: 8 }}      // new object every render
  items={data.filter(fn)}    // new array every render
  render={() => <Icon />}    // new function every render
/>
```

Any one of those fails the shallow compare. `memo` returns false and the child renders. JSX passed as `children` does the same, because it is a new element object each time.

This is why blanket `useCallback` produces no measurable improvement. The team wraps every handler and feels productive. The component tree then renders exactly as much as before, because a `style` object nobody noticed breaks every comparison.

## What it costs

`useCallback` is not free.

- Every call allocates a dependency array and stores the previous function. You add memory and comparison work to every render to avoid work that may never come.
- It adds a correctness surface. A missing dependency gives you a stale closure — a handler that captures old state and quietly does the wrong thing. That bug class is real, and it hides better than a slow render does.
- It adds noise. Every handler grows a wrapper and a dependency array, so the code that matters is harder to see.

For a component rendering a dozen DOM nodes, the render you avoided cost less than the memoization you added.

## When it is genuinely worth it

Reach for `memo` plus `useCallback` when one of these holds:

- The child is expensive to render — a large list, a chart, a heavy tree — and you have measured it.
- The child renders hundreds of times, so a small per-render cost multiplies.
- The function goes into the dependency array of a `useEffect` or `useMemo`, where an unstable reference causes re-subscribes or re-computation. This one is about correctness, not render count, and it is the strongest reason.
- The value feeds a context provider, where an unstable reference re-renders every consumer.

That last pair matters more than the render-skipping case. They are the reasons to keep `useCallback` in your vocabulary at all.

## Cheaper things to try first

Re-render complaints are usually structural, and the structural fix costs less than memoizing.

**Move state down.** If only one subtree needs the state, put the state in that subtree. The parent stops re-rendering and the problem disappears.

**Pass children as props.** A component that renders `{children}` does not re-render those children when its own state changes. The parent above created those elements.

```jsx
function Panel({ children }) {
  const [open, setOpen] = useState(false)
  return <div>{open && children}</div>   // children not re-created here
}
```

**Split the component.** One component holding fast-changing state and slow-rendering markup re-renders the markup on every tick. Two components do not.

## The right order of operations

Profile first. React DevTools ships a Profiler that shows what re-rendered, how long it took, and why. Turn on "Record why each component rendered."

If nothing is slow, you have no problem to fix. Renders are not inherently bad. React is built on them being cheap. A tree that re-renders sixty times a second in two milliseconds is fine.

If something is slow, the profiler names it. Memoize that one component with `memo` and `useCallback` together, then verify the improvement in the profiler.

## Worth mentioning

The React Compiler, shipping as of React 19, applies this memoization automatically across the whole tree. If the project runs a version that supports it, enabling the compiler beats hand-wrapping. It does not miss dependencies, and it does not skip the `style` object your teammate would have.

## Summary for the teammate

Wrapping every prop function in `useCallback` will not stop a single re-render on its own. The parent drives re-rendering, not prop identity. Skipping needs three things: `React.memo` on the child, every prop stable, and a child expensive enough to earn it. Profile, find the component that costs real time, and fix that one.
