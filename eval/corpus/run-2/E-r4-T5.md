---
kind: eval-artifact
run: 2
variant: E
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you something. `useCallback` gives you a stable function reference. That stops a re-render only if the child is wrapped in `React.memo`. Without `memo`, the child re-renders whenever the parent does, no matter how stable the prop is — so every `useCallback` you added is pure overhead.

Even with `memo` on the child, one unstable prop defeats the whole thing. `memo` does a shallow compare across all props. If you stabilize `onClick` but still pass `style={{ color: "red" }}` or `items={data.filter(...)}`, those are new references every render and the child re-renders anyway. Your stable callback did nothing.

`useCallback` is not free either. Every call allocates the dependency array, stores it, and compares it on the next render. That work is small but real, and it runs on every render of every component that uses it. Blanket-applying it makes the codebase slower in aggregate and noticeably harder to read.

Worse, it rots. Dependency arrays go stale as the code changes. A `useCallback` with a wrong dependency captures an old value and produces a bug that is genuinely painful to track down. Hundreds of them mean hundreds of chances to get that wrong.

**What to do instead:** measure first. Open the React DevTools Profiler, record an interaction that feels slow, and look at what actually re-renders and how long it takes. Most re-renders cost under a millisecond and no user will ever notice.

When you find a real problem, apply the fix where the profiler pointed. That usually means `memo` on the specific expensive child plus `useCallback` and `useMemo` on all of its props, together, as one deliberate unit. Half the pattern is worse than none of it, because you pay the cost and get no benefit.

One caveat: `useCallback` also matters when the function is a dependency of a `useEffect`. There an unstable reference re-runs the effect, which can mean a refetch or a resubscribe on every render. That is a correctness issue, not a rendering optimization, and it is worth fixing regardless of what the profiler says.

Also worth knowing: the React Compiler does this memoization automatically and gets it right. If you can adopt it, that beats hand-writing any of this.
