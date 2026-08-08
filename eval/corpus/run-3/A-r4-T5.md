---
kind: eval-artifact
run: 3
variant: A
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and it'll cost you readability plus a little runtime overhead for the privilege. Worth understanding why before doing it everywhere.

`useCallback` stabilizes the *identity* of the function across renders. But a plain child component doesn't care about prop identity at all — it re-renders whenever its parent re-renders, full stop. So:

```jsx
const handleClick = useCallback(() => {...}, [])
return <Child onClick={handleClick} />   // Child still re-renders
```

Stable prop, re-render anyway. The memoization did nothing except allocate a dep array and run a comparison.

`useCallback` only pays off when something downstream is actually comparing props. That means one of:

- **The child is wrapped in `React.memo`.** This is the big one. `memo` shallow-compares props and bails out if they're equal — but an inline arrow function is a new reference every render, so a single unstable prop defeats the entire memo. `useCallback` is what makes `memo` work. The two are a pair; neither does much alone.
- **The function is a dependency of a `useEffect`/`useMemo`.** Then unstable identity causes the effect to re-run, which can mean refetching or resubscribing on every render. That's a correctness/behavior bug, not just a perf one, and it's the case where `useCallback` genuinely matters.
- **The child is expensive and you've measured it.** Rare, but real for big lists and heavy charts.

Absent those, you're paying a small cost — the closure, the deps array, the comparison on every render — for zero benefit.

The other thing to flag: `useCallback` with a wrong dep array is worse than no `useCallback`. Miss a dep and you've frozen a stale closure into place, and the bug it produces ("why is this using last week's filter value") is much harder to find than a re-render.

**What I'd suggest instead of blanket-wrapping:** profile first. React DevTools Profiler with "record why each component rendered" turned on will show you exactly which components are re-rendering and what triggered it. Usually the real cause is something structural — state living too high in the tree, a context value that's a fresh object literal each render, a list without stable keys. Fixing that removes far more re-renders than any amount of `useCallback` will.

Worth knowing: if you're on React 19 with the compiler enabled, it does this memoization automatically and hand-written `useCallback` is largely redundant. Check whether that's on before investing effort here.
