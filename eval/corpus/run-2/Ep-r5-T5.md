---
kind: eval-artifact
run: 2
variant: Ep
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, that will not work on its own. `useCallback` stabilizes the function's identity, but the child still re-renders unless it is wrapped in `React.memo`.

By default, a parent re-render re-renders all its children, regardless of whether props changed. React does not compare props before rendering. `React.memo` is what adds that comparison, and `useCallback` is what makes the comparison come out equal for function props. You need both, or neither does anything.

So blanket `useCallback` costs you something and buys nothing:

- Every call allocates the dependency array and runs the comparison on every render.
- The wrapped function stays in memory across renders.
- The code gets noisier, and the dependency arrays drift out of sync with the function bodies.

There is a second trap even after adding `React.memo`. If any *other* prop is a fresh object or array literal, memo's comparison fails anyway and the callback stabilization is wasted:

```tsx
<Child onSave={stableCallback} config={{ mode: "edit" }} /> // new object every render
```

You have to stabilize every non-primitive prop, not just the functions.

What to do instead:

1. **Measure first.** Open the React DevTools Profiler and find which components actually cost time. Most re-renders are cheap and invisible.
2. **Apply memo + useCallback together, at the specific boundary you measured.** Good candidates are components rendering large lists, running expensive computations, or sitting under a frequently-updating parent.
3. **Try moving state down or lifting content up before reaching for memo.** If the state lives closer to where it is used, the expensive subtree never re-renders in the first place. That is a real fix rather than a comparison tax.

One thing worth knowing: if your project is on React 19 with the React Compiler enabled, it inserts this memoization for you and hand-written `useCallback` is mostly redundant. Check whether that is on before doing the work by hand.
