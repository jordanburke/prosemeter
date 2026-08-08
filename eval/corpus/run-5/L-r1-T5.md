---
kind: eval-artifact
run: 5
variant: L
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you. `useCallback` alone does not stop a child re-rendering. The child re-renders when its parent renders, whatever its props are.

Here is the actual rule. React re-renders every child of a re-rendered component by default. Props are not consulted. `useCallback` only gives you a stable function reference — it does not tell React to skip anything.

Skipping requires `React.memo` on the child. `memo` makes the child compare its props against the last render and bail out when they are all equal by reference. *Then* a stable function reference matters, because an unstable one fails the comparison and defeats the memo.

So the two go together:

```jsx
const Row = React.memo(function Row({ onSelect }) { ... })

// parent
const handleSelect = useCallback((id) => select(id), [select])
<Row onSelect={handleSelect} />
```

Take away `memo` and the `useCallback` does nothing. Take away `useCallback` and the `memo` does nothing. Your teammate is planning to build half the mechanism everywhere.

The cost of doing it everywhere is real, if small per instance. Every `useCallback` allocates a dependency array, stores the previous one, and compares them on every render. You pay that on every render to maybe save work you were not spending. Wrapping every prop function makes the code noisier, adds a dependency array to keep correct, and creates a new bug class: a stale closure when the array is wrong.

Something else usually breaks it anyway. If any other prop is an object or array literal, it is a fresh reference each render and the memo fails regardless:

```jsx
<Row onSelect={handleSelect} style={{ margin: 8 }} />   // memo never hits
```

Children props have the same problem. `<Card>{<Thing />}</Card>` creates a new element each render.

What to do instead:

**Measure first.** Open the React DevTools Profiler, record an interaction, and find what actually renders too much and takes too long. Most re-renders are cheap — React renders, diffs, and touches no DOM. A re-render is not a repaint.

**Fix the structure before reaching for memo.** Move state down so fewer components sit under it. Lift expensive subtrees out as `children`, which the parent does not recreate. Split a big context into the pieces that change at different rates. These fixes remove renders instead of filtering them.

**Then memoize the specific hot spot** — a long list row, an expensive chart — with `memo` plus `useCallback` plus `useMemo` on every prop it takes. As a set, at one place, because you measured it.

Worth knowing: the React Compiler, stable as of React 19, inserts this memoization automatically and better than a human does by hand. If you can adopt it, the whole debate goes away.
