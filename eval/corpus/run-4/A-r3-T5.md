---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and I'd push back on doing it wholesale.

The reason: `useCallback` gives you a stable function identity, but a stable prop only prevents a re-render if the child is actually checking props for equality. A plain function component re-renders whenever its parent re-renders, full stop — it doesn't compare anything. So wrapping the callback changes nothing at all unless the child is wrapped in `React.memo`.

`useCallback` and `React.memo` are two halves of one mechanism. Either alone does nothing.

And even with both in place, memoization only holds if *every* prop is referentially stable. One inline object, one array literal, one `style={{ margin: 4 }}`, one un-memoized child callback, and `React.memo`'s comparison fails and you re-render anyway — now with the added cost of the failed comparison and all the retained closures. This is why blanket-memoizing so often produces no measurable improvement: the memo boundary is leaking through some other prop nobody audited.

The cost side is real but modest, and it's worth being honest about both directions:

- Every `useCallback` allocates a closure and a dep array on every render regardless — you don't skip work, you add a comparison. For a cheap child, the memoization costs more than the render it prevents.
- Dependency arrays are a correctness hazard. A stale value captured in a `useCallback` with an incomplete dep array is a genuinely nasty bug class, and it's one you're now introducing across every callback in the codebase.
- It's noise. Every prop wrapped means the ones that matter don't stand out, and nobody can tell which memoizations are load-bearing.

What I'd do instead:

**Measure first.** Open the React DevTools Profiler, record an interaction that feels slow, and look at what's actually rendering and how long it takes. Most of the time the answer is "renders are fine, one component is doing expensive work" or "we're rendering a 5,000-row list," and neither is fixed by `useCallback`.

**Then apply memoization surgically** where the profiler says a child is expensive and re-rendering unnecessarily — big lists, chart components, anything with heavy layout. In those spots do it properly: `React.memo` on the child, `useCallback` on the handlers, `useMemo` on any object or array props. All of it, or none of it.

**Consider whether the structure is the problem.** A lot of over-rendering comes from state living too high in the tree. Moving state down to the component that actually uses it, or passing children as a prop so the expensive subtree isn't re-created, eliminates the re-render entirely instead of memoizing around it. That's usually the better fix and it needs no hooks at all.

Also worth knowing: if you're on React 19 with the compiler enabled, it does this analysis automatically and hand-written `useCallback` becomes largely redundant. Might be worth checking where the project stands on that before investing a day in manual memoization.
