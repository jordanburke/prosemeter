---
kind: eval-artifact
run: 3
variant: A
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and it'll cost you something. `useCallback` on its own does not prevent a single re-render.

The thing to internalize: **a child re-renders when its parent re-renders, regardless of props.** That's the default. Props don't enter into it. So if `<Child onClick={handleClick} />` re-renders when the parent does, wrapping `handleClick` in `useCallback` changes nothing at all — the child was never re-rendering because the prop changed.

`useCallback` only matters when the child is wrapped in `React.memo`. `memo` says "skip the re-render if props are shallowly equal," and *that's* the check an inline function breaks, because `() => {}` is a new reference every render. So the mechanism is a pair:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })

// parent
const handleClick = useCallback(() => doThing(id), [id])
return <Child onClick={handleClick} />
```

Both halves or neither. `useCallback` without `memo` is dead weight. `memo` without `useCallback` is a comparison that always fails. Your teammate is proposing to do half of it everywhere.

And "half of it" isn't free:

- Every `useCallback` allocates the function *and* the dependency array, then runs a comparison on each render. You're adding work to prevent work that wasn't happening.
- Dependency arrays are a live correctness surface. A missing dep gives you a stale closure — a handler that fires against last render's state — and those bugs are genuinely nasty to track down.
- It's noise. Wrapping everything means the wrapper stops signaling anything, so when it *is* load-bearing nobody can tell.

There's also a failure mode where you do both halves and still get nothing, because some *other* prop is unstable:

```jsx
<Child onClick={handleClick} style={{ margin: 8 }} items={data.filter(Boolean)} />
```

The memoized callback is stable, and `style` and `items` are brand new objects every render, so the shallow compare fails anyway and you re-render regardless. `memo` is all-or-nothing across props — one unstable prop defeats the whole thing. This is why "I added useCallback and nothing improved" is such a common report.

What I'd actually suggest:

**Profile first.** React DevTools Profiler, record an interaction, look at what's expensive. Re-rendering a component that returns a div is genuinely cheap — React does it fast and diffs it away. The re-renders worth eliminating are ones where the child does real work: a big list, a chart, an expensive derived computation.

**Then memoize the specific thing.** Find the component that's actually slow, wrap it in `memo`, and stabilize *all* of its props — which is where `useCallback` and `useMemo` earn their place.

**Or restructure instead.** Often the better fix isn't memoization at all: move state down so fewer components re-render, or pass the expensive subtree as `children` so it isn't recreated by the parent's render. Cheaper and more durable than a memo boundary someone has to maintain.

Two carve-outs where blanket `useCallback` is defensible: a function going into another hook's dependency array (where an unstable reference causes an effect to loop), and a function on a context value (where instability re-renders every consumer). Those are real. "Stop children re-rendering" is not, by itself.

And worth mentioning — if you're on React 19 with the compiler enabled, it does this analysis automatically and manual wrapping is largely obsolete. Might be worth checking before anyone spends a day on it.
