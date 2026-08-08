---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and I'd hold off on the blanket version.

`useCallback` gives you a stable function *reference*. That only prevents a re-render if something downstream is actually comparing references. By default, nothing is. When a parent re-renders, React re-renders all its children regardless of whether their props changed — prop identity isn't consulted at all. So wrapping the handler in `useCallback` changes nothing except adding a memo lookup.

It only pays off when the child is wrapped in `React.memo` (or is `PureComponent`), because that's what introduces the shallow prop comparison. `useCallback` without `memo` on the other side is a no-op with overhead.

And even with `memo` in place, there are three ways it silently stops working:

**Unstable deps.** If the callback closes over something that changes every render, the dep array changes every render, and you get a new function every render anyway:

```tsx
const handleClick = useCallback(() => submit(formState), [formState])
```

`formState` changes as the user types, so this is a fresh reference on every keystroke. You've paid the cost and gotten nothing.

**One unmemoized sibling prop ruins it.** `memo` does a shallow compare over *all* props. If you pass `style={{ margin: 8 }}` or `items={data.filter(x => x.active)}` next to your carefully memoized callback, that inline object is new every render and the comparison fails. Every prop has to be stable, not just the functions.

**Children.** `<Memoized><Thing /></Memoized>` passes `children` as a prop, and that JSX element is a new object each render. Memo defeated.

There's also a real cost, even if it's small: an extra closure allocation and dep-array comparison per render, per callback, plus the retained references living in memory. Applied to every prop function in the app, that's not free, and it's a permanent tax on readability and on the review burden of keeping dep arrays correct. Wrong dep arrays are a genuine source of stale-closure bugs — you can absolutely make things worse.

What I'd do instead:

1. **Profile first.** React DevTools Profiler, record an interaction, look at what's actually expensive. Nine times out of ten the slow thing is one specific subtree — a big list, a chart, an editor — not the diffuse cost of everything re-rendering. Re-rendering a component that returns a `<div>` and a `<span>` is genuinely cheap; React is fast at that.
2. **Memoize the expensive subtree**, then make its props stable — including the callbacks. Targeted `memo` + `useCallback` around a known-costly component is exactly the right use of both.
3. **Consider state placement.** A lot of "everything re-renders" problems are really "state lives higher than it needs to." Pushing state down, or splitting one big context into narrower ones, often removes the re-renders entirely rather than making them cheaper to skip.

If you're on React 19 with the compiler enabled, this is even more clearly not worth doing manually — the compiler inserts memoization automatically and hand-written `useCallback` mostly just gets in its way.

Short version: it's a targeted optimization, applied after measurement, in pairs with `memo`. As a blanket policy it's cost with no benefit.
