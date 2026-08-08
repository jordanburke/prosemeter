---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
On its own, no — `useCallback` alone won't stop the re-renders.

`useCallback` only keeps the *function reference* stable across renders. It doesn't stop the child from re-rendering. A plain function component re-renders whenever its parent re-renders, no matter how stable its props are — React doesn't check props unless you tell it to.

The piece that's missing is `React.memo` on the child. `memo` is what makes React skip a re-render when props haven't changed. `useCallback` is what makes the function prop count as "unchanged" for that comparison. You need both, and they only work as a pair:

```tsx
const Child = React.memo(function Child({ onClick }) {
  // ...
})

function Parent() {
  const onClick = useCallback(() => {
    // ...
  }, [])
  return <Child onClick={onClick} />
}
```

Without `memo` on `Child`, wrapping `onClick` in `useCallback` buys nothing — `Child` re-renders every time `Parent` does regardless.

Two more things worth flagging before your teammate wraps *every* function prop:

- **It has a real cost.** Every `useCallback` call allocates a dependency array and does a comparison on every render. If the child isn't memoized, or isn't expensive to render, this is pure overhead for no benefit.
- **Other props can break memoization anyway.** If any other prop is an object, array, or inline-created value (`{ foo: bar }`, `[1,2,3]`), that prop is a new reference every render, and `memo`'s shallow comparison fails regardless of what `useCallback` does for the function prop.

So the actual fix is: find the children that are genuinely expensive to re-render, wrap those specific ones in `memo`, and only then stabilize the props they receive with `useCallback`/`useMemo`. Applying it everywhere is extra code for renders that were never a problem.
