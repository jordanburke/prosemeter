---
kind: eval-artifact
run: 5
variant: A
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost something. `useCallback` alone stops nothing. The child re-renders anyway.

## Why the child still re-renders

React re-renders a child whenever its parent re-renders. That is the default, and it has nothing to do with props. Change no props at all and the child still re-renders.

`useCallback` only makes the function reference stable between renders. Stability matters solely to code that *compares* props — and by default nothing compares props.

So the sequence is:

1. Parent re-renders.
2. React re-renders every child in its tree.
3. The stable callback is never consulted, because nobody checked.

## What it takes to actually skip the child

Two pieces, and you need both:

```jsx
const Child = React.memo(function Child({ onSave }) { /* ... */ })

// in the parent
const handleSave = useCallback(() => save(id), [id])
```

`React.memo` is the piece that does the skipping. It shallow-compares props and bails out of the re-render when they all match. `useCallback` is the piece that lets the function prop pass that comparison.

Without `memo`, `useCallback` is pure overhead. Without `useCallback`, `memo` fails on the first inline function you pass. Your teammate is proposing to install half the mechanism everywhere.

## The other half that breaks it silently

Even with both, one unstable prop defeats the whole thing. `memo` compares *all* props, and any of these is new on every render:

```jsx
<Child
  onSave={handleSave}        // stable, good
  style={{ margin: 8 }}      // new object every render
  items={data.filter(fn)}    // new array every render
  render={() => <Icon />}    // new function every render
/>
```

Any one of those makes the shallow compare fail, `memo` returns false, and the child renders. So does `children` as JSX, which is a new element object each time.

This is why blanket `useCallback` so often produces no measurable improvement. The team wraps every handler, feels productive, and the component tree renders exactly as much as before because a `style` object nobody thought about is breaking every comparison.

## What it costs

`useCallback` is not free.

- Every call allocates a dependency array and stores the previous function. You are adding memory and comparison work to every render to *maybe* avoid work later.
- It adds a correctness surface. A missing dependency gives you a stale closure — a handler that captures old state and quietly does the wrong thing. That is a real bug class, and it is harder to find than a slow render.
- It adds noise. Every handler grows a wrapper and a dependency array, so the code that matters is harder to see.

For a component rendering a handful of DOM nodes, the render you avoided was cheaper than the memoization you added.

## When it is genuinely worth it

Reach for `memo` plus `useCallback` when one of these is true:

- The child is expensive to render — a large list, a chart, a heavy tree — and you have measured it.
- The child renders many times, so a small per-render cost multiplies.
- The function goes into a dependency array of a `useEffect` or `useMemo`, where an unstable reference causes re-subscribes or re-computation. This one is about correctness and effects, not render count, and it is the strongest reason.
- The value feeds a context provider, where an unstable reference re-renders every consumer.

That last pair matters more than the render-skipping case, and they are the reasons to keep `useCallback` in your vocabulary at all.

## Cheaper things to try first

Most "too many re-renders" problems are structural, and the fix costs less than memoizing.

**Move state down.** If only one subtree needs the state, put the state in that subtree. The parent stops re-rendering and the whole problem disappears.

**Pass children as props.** A component that renders `{children}` does not re-render those children when its own state changes, because the elements were created by the parent above.

```jsx
function Panel({ children }) {
  const [open, setOpen] = useState(false)
  return <div>{open && children}</div>   // children not re-created here
}
```

**Split the component.** One component holding fast-changing state and slow-rendering markup re-renders the markup on every tick. Two components do not.

## The right order of operations

Profile first. React DevTools has a Profiler that shows what re-rendered, how long it took, and why. Turn on "Record why each component rendered."

If nothing is slow, there is no problem to fix. Renders are not inherently bad — React is designed around them being cheap. A tree that re-renders sixty times a second and takes two milliseconds is fine.

If something is slow, the profiler names it, and you memoize that one thing with `memo` and `useCallback` together, verifying the improvement in the profiler afterward.

## Worth mentioning

The React Compiler, shipping as of React 19, does this memoization automatically and correctly across the whole tree. If the project is on a version that supports it, enabling the compiler is strictly better than hand-wrapping — it does not miss dependencies, and it does not skip the `style` object your teammate would have.

## Summary for the teammate

Wrapping every prop function in `useCallback` will not stop a single re-render on its own, because re-rendering is driven by the parent, not by prop identity. Skipping requires `React.memo` on the child, every prop stable, and a child expensive enough to be worth it. Profile, find the component that actually costs something, and fix that one.
