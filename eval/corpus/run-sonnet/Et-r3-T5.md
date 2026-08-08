---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
On its own, no. `useCallback` stops the *function* from being a new object each render. It does nothing to stop the *child* from re-rendering, unless the child also skips re-render on unchanged props.

React re-renders a child whenever its parent re-renders, regardless of whether the props changed, unless the child is wrapped in `React.memo`. Without that wrapper, `useCallback` just hands the child the same function reference — the child still re-renders anyway, so nothing changes.

So the fix needs both pieces:

```jsx
const Child = React.memo(function Child({ onClick }) {
  // ...
})

function Parent() {
  const handleClick = useCallback(() => {
    // ...
  }, [])
  return <Child onClick={handleClick} />
}
```

`React.memo` skips the re-render when props are shallow-equal. `useCallback` makes the function prop stable so it *stays* shallow-equal across renders. Neither one alone solves the problem — they work as a pair.

One more thing worth saying: wrapping every function in `useCallback` has a real cost (extra memory, extra comparison work, more code to read) and most components don't re-render often enough to matter. Reach for this pair only where you've measured a real re-render cost — a long list, a heavy chart, something visibly slow — not as a default habit.
