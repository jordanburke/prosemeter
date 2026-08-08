---
kind: eval-artifact
run: 3
variant: E
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will make the code noisier. `useCallback` on its own stops nothing.

Here is why. A normal child component re-renders whenever its parent re-renders, no matter what the props are. React does not compare props unless you tell it to. So a stable function identity changes nothing — the child was never looking at it.

You need `React.memo` on the child for prop identity to matter at all:

```js
const Child = React.memo(function Child({ onSelect }) { ... })
```

Now React shallow-compares props before re-rendering, and `useCallback` on `onSelect` starts doing work. The two only pay off together. That is the actual rule: `useCallback` is the fix for the hole `memo` leaves, not a standalone optimization.

Even paired, it breaks easily. If any other prop is a fresh object or array each render — `style={{ margin: 4 }}`, `items={data.filter(...)}` — the shallow compare fails and the child re-renders anyway. You end up memoizing every prop to save one re-render.

And it is not free. Every `useCallback` allocates the closure, keeps the previous one alive for comparison, and adds a deps array someone has to maintain. Get the deps wrong and you capture a stale value, which is a real bug, not a slow render. Wrapping everything means dozens of chances to make that mistake in exchange for savings you have not measured.

What I would do instead:

1. **Profile first.** React DevTools Profiler shows which components re-render and how long they take. Most re-renders are under a millisecond and cost nothing.
2. **Memoize where it is proven expensive** — big lists, heavy charts, deep trees. Those are where a skipped render is worth real time.
3. **Move state down** so fewer components re-render at all. This beats memoization and leaves the code simpler.
4. **Pass children as props** to avoid re-rendering subtrees that do not depend on the changing state.

Worth knowing: the React Compiler does this automatically and gets it right more often than hand-written memoization. If you are on React 19 and can enable it, that is a better use of the effort than a blanket `useCallback` pass.
