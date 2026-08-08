---
kind: eval-artifact
run: 5
variant: L
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, because `useCallback` alone does nothing to stop a child re-rendering. A normal React child re-renders whenever its parent re-renders, no matter how stable its props are. Your teammate would add code and cost everywhere, and get no benefit anywhere.

Here is the rule React actually follows. When a component re-renders, React re-renders its whole subtree by default. It does not compare props first. Prop identity only enters the picture if the child is wrapped in `React.memo`, which tells React to skip the re-render when props are shallowly equal.

So the two pieces work as a pair. `React.memo` on the child does the comparing. `useCallback` on the function prop keeps the comparison from failing, because a function defined in the render body is a new object every render and would break shallow equality on its own. One without the other buys nothing.

Even paired, the win is often small. `useCallback` is not free. It allocates a dependency array, stores the function, and runs a comparison on every render. For a child that is cheap to render — a button, a list row with a few divs — that overhead is real and the saved render was not worth saving. The React team's own guidance says to reach for memoization when you have measured a problem, not by default.

There is a further trap. A `useCallback` whose dependencies change on every render returns a new function every render anyway. Your teammate ships all the cost and none of the stability, and the code now *looks* optimized, which makes the real problem harder to find later.

`React.memo` also breaks on any other unstable prop. Pass `style={{ margin: 8 }}` or `items={data.filter(...)}` and you create a fresh object each render, the shallow comparison fails, and the child re-renders regardless of how stable the callback was.

When memoization is the right tool, it looks like this: the child is genuinely expensive — a big list, a chart, a heavy tree — and it is wrapped in `React.memo`, and *every* one of its props is stable. That means `useCallback` for functions, `useMemo` for objects and arrays, and primitives passed directly.

Better moves usually come first. Move state down so fewer components sit under the re-rendering parent. Pass children as the `children` prop, so the expensive subtree is created by a component that is not re-rendering. Split a large component so the frequently-changing state lives in a small leaf.

Tell your teammate to profile before optimizing. The React DevTools Profiler shows which components re-render and how long each one takes. If the flame chart is already a few milliseconds, blanket `useCallback` adds work and solves nothing.

One last note. The React Compiler, now stable, does this memoization automatically and more precisely than hand-written hooks. If your project can adopt it, that is the real answer, and hand-rolled `useCallback` everywhere becomes code to delete.
