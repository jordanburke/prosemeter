---
kind: eval-artifact
run: 3
variant: B
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and it'll cost you readability for nothing. Here's why.

**`useCallback` alone doesn't prevent anything.** It gives you a stable function reference across renders. But a normal child component re-renders whenever its parent re-renders, regardless of whether its props changed. The stable reference is only useful if something is actually *comparing* props — which means the child has to be wrapped in `React.memo`.

So `useCallback` without `memo` on the child does nothing except add a dependency array you now have to maintain. It's not free either — React still allocates the callback and does the dependency comparison on every render. Small cost, but a cost with no benefit.

**Even with `memo`, one unstable prop ruins it.** `React.memo` does a shallow comparison of all props. If you stabilize the callback but still pass:

```jsx
<Child onClick={handleClick} style={{ margin: 8 }} items={data.filter(x => x.active)} />
```

...then `style` and `items` are brand new objects every render, the shallow compare fails, and the child re-renders anyway. Your `useCallback` did nothing. Memoization is all-or-nothing per component — you have to stabilize *every* prop, or none of it counts.

**And the dependencies have to actually be stable.** If your `useCallback` depends on an object that's recreated each render, the callback identity changes each render too. You've just moved the problem one level up.

**What I'd suggest instead:**

- **Don't optimize until you've measured.** Open React DevTools Profiler, record an interaction that feels slow, and look at what's actually expensive. Re-rendering a component that renders a div and some text costs essentially nothing — React is fast at this. The problem is almost never "too many re-renders," it's one specific component doing real work.
- **When you do find a hot spot, memoize deliberately.** Wrap *that* child in `memo`, stabilize *all* of its props, and confirm in the profiler that the re-renders stopped. That's a targeted fix you can verify.
- **Consider whether the structure is the problem.** Often the better fix is moving state down so fewer components re-render at all, or passing children as props so a subtree doesn't re-render with its parent.

Worth knowing: the React Compiler does this kind of memoization automatically and correctly, which is part of why hand-applying `useCallback` everywhere is falling out of favor. If we're on a version that supports it, that's the conversation to have rather than a manual pass over every prop.
