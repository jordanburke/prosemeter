---
kind: eval-artifact
run: 3
variant: B
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
On its own, no — it won't stop a single re-render.

`useCallback` keeps the function reference stable between renders. That's genuinely useful. But a normal React child re-renders whenever its parent re-renders, regardless of whether its props changed at all. React doesn't check. So the stable reference has nothing to act on.

To actually skip the re-render, the child has to be wrapped in `React.memo`. That's the piece that compares props and bails out when they're the same. `useCallback` is what makes that comparison *succeed* — without it, the function prop is a new reference every render and `memo` gives up immediately.

So they're a pair:

```js
const Child = React.memo(function Child({ onClick }) { ... })

// in the parent
const handleClick = useCallback(() => { ... }, [id])
<Child onClick={handleClick} />
```

Miss either half and you get nothing.

Worth saying too: wrapping *every* callback isn't free. `useCallback` allocates the dependency array, runs a comparison, and holds the previous function in memory on every render. It's small, but it's a real cost paid on every render of every component, in exchange for savings that only materialize where a `memo`'d child was actually going to do expensive work.

Most re-renders are cheap. React re-rendering a component that returns a few divs is genuinely fast, and a blanket `useCallback` policy makes the code noisier for no measurable gain — plus the dependency arrays are a live source of stale-closure bugs.

Better approach: profile first. Open the React DevTools Profiler, record an interaction that feels slow, and see what's actually expensive. Then apply `memo` + `useCallback` at those specific spots. Usually it's one or two components — a big list, a heavy chart — not the whole tree.

One note if the codebase is on React 19: the React Compiler does this memoization automatically and is much better at knowing when it's worth it. If that's in play, hand-written `useCallback` is mostly redundant.
