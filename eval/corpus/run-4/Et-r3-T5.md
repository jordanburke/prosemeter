---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, not on its own. `useCallback` gives you a stable function reference. It does nothing to stop a re-render unless the child is wrapped in `React.memo`.

**Why.** A plain child re-renders whenever its parent re-renders, full stop. React does not compare props for it. So a stable callback prop changes nothing — you have added a hook, a dependency array, and a memo cache entry, and bought zero skipped renders.

`React.memo` is the part that compares props. `useCallback` only makes the comparison come out equal.

**Where it does pay off.** The child is memoized, and every other prop is already stable. Miss any one of those and the memo fails anyway:

```tsx
<MemoChild onClick={handleClick} style={{ margin: 8 }} items={data.filter(Boolean)} />
```

The object literal and the fresh array are new every render. The memo comparison fails on those regardless of `handleClick`.

**The deps bite too.** If the callback closes over a value that changes each render, `useCallback` returns a new function each render and you are back where you started.

**What I would do instead:**

1. **Measure first.** Open the React Profiler and find the components that actually cost time. Most re-renders are cheap — rendering a div is not a performance problem.
2. **Fix the cause, not the symptom.** Usually the tree re-renders because state sits too high. Move state down to the component that uses it, or pass children through so the expensive subtree keeps its identity.
3. **Memoize the few that earn it.** Big lists, chart components, anything doing real work in render.

**One caveat on the "just measure" advice.** If you are on React 19 with the compiler enabled, it inserts this memoization for you and hand-written `useCallback` is mostly dead weight. Check whether the compiler is on before you spend a day adding hooks it would have written.
