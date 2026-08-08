---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It mostly won't, and it'll cost you readability on the way. `useCallback` only prevents a re-render when the child is *also* wrapped in `React.memo`. Without that, the child re-renders whenever the parent does, regardless of whether the prop reference changed — memo is the thing that checks props, and an unmemoized child never checks.

So the plain version:

```tsx
const handleClick = useCallback(() => doThing(id), [id])
return <Row onClick={handleClick} />   // Row re-renders anyway
```

You've added a hook, a dependency array, and a maintenance obligation, and changed nothing observable.

Even with `React.memo` on the child, it only works if *every* prop is reference-stable. One inline object or array undoes the whole thing:

```tsx
<Row onClick={handleClick} style={{ margin: 4 }} />   // new object each render, memo always fails
```

That's the usual reason a "we memoized it" fix doesn't move the needle — people memoize the callbacks and leave the object literals in place.

And it isn't free. Every `useCallback` allocates the function *plus* the dependency array and runs a comparison on each render. For a cheap child, that's strictly more work than just re-rendering. Bigger cost is correctness: a dependency array that drifts out of sync with the closure gives you a stale callback, and those bugs are genuinely nasty to track down.

What I'd actually do:

- **Profile first.** React DevTools Profiler, record an interaction, look at what's actually expensive. Re-rendering is usually fine — React is fast at it. The problem is almost never "too many renders," it's one component doing real work on every render.
- **Fix the structure instead** where you can. Moving state down so fewer components sit under it, or passing children through as a prop so they don't re-render with the parent, eliminates the problem rather than papering over it. `{children}` passed from above doesn't re-render when the wrapper's state changes — that's free and requires no hooks.
- **Reach for memo + useCallback deliberately**, on the specific subtree the profiler flagged, usually a big list or an expensive chart.

Worth mentioning: if you're on React 19 with the compiler enabled, it does this automatically and better than hand-written memoization. Manually memoizing everything is work you'd then want to undo. Which version are we on?
