---
kind: eval-artifact
run: 2
variant: E
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That will not stop the re-renders on its own. `useCallback` keeps the function reference stable, but a plain child re-renders whenever its parent does, no matter what props it gets. The stable reference only matters once the child is wrapped in `React.memo`.

So the two go together:

```tsx
const handleClick = useCallback(() => save(id), [id])
// and
const Child = React.memo(function Child({ onClick }) { ... })
```

Wrap the child in `memo` and it starts comparing props. Give it a stable callback and the comparison passes. Miss either half and you get nothing.

Even with both, one unstable prop defeats the whole thing. An inline object like `style={{ margin: 8 }}`, an inline array, or a `children` element built in the parent all create a fresh reference each render, and `memo` bails out on the first mismatch. The `useCallback` was correct and the component still re-renders.

Worth saying: `useCallback` is not free. It runs on every render, allocates a dependency array, and adds code you have to keep correct. Applying it everywhere makes the codebase noisier and slower to read while usually changing nothing measurable, because React re-renders are cheap when the tree is small.

I would do this instead. Leave it off by default. Profile with the React DevTools profiler, find the components that actually cost something, and apply `memo` plus `useCallback` there. The usual wins are big lists, expensive charts, and anything rendering hundreds of rows.

One case where it is required regardless of speed: a callback in a `useEffect` dependency array. An unstable function there re-runs the effect every render, which is a correctness bug, not a performance one.
