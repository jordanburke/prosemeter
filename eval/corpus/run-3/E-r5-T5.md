---
kind: eval-artifact
run: 3
variant: E
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you. `useCallback` alone stops nothing — the child re-renders anyway unless it is wrapped in `React.memo`.

Here is the mechanism. A parent re-render re-renders all its children by default, whatever the props are. React does not compare props unless you ask it to. `React.memo` is what asks. So a stable function reference only matters as an input to a comparison that `memo` performs; with no `memo`, nothing compares anything and the stable reference does no work.

You need both halves:

```tsx
const Child = React.memo(function Child({ onSave }: Props) {
  return <button onClick={onSave}>Save</button>
})

// parent
const handleSave = useCallback(() => save(id), [id])
return <Child onSave={handleSave} />
```

And even both halves fail if any other prop is fresh each render. One `style={{ margin: 8 }}` or `items={data.filter(...)}` in the JSX creates a new object every time, `memo`'s shallow compare sees a change, and the child re-renders regardless of how carefully you memoized the callback.

The cost side is real. Every `useCallback` adds a dependency array React must allocate and compare on each render, plus the closure it holds. Wrapping everything means you pay that on every render for every prop, to prevent re-renders that were mostly cheap. Re-rendering a component that returns a few divs costs microseconds. You can easily spend more on the memoization than you save.

Do this instead. Profile first with the React DevTools Profiler and find components that actually render often and render slowly. Those are usually big lists, heavy charts, and expensive tree computations. Apply `memo` plus `useCallback` there, as a matched pair, and verify the flame graph got shorter.

Worth mentioning: the React Compiler does this automatically and correctly, based on real dataflow. If you are on React 19, turn it on and delete the hand-written memoization instead of adding more.
