---
kind: eval-artifact
run: 2
variant: G
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It won't work, and it will cost you a little performance. `useCallback` alone does nothing to stop a child re-rendering.

Here's why. A normal child component re-renders whenever its parent re-renders, no matter what the props are. React doesn't compare props to decide — it just re-renders the subtree. So a stable function identity changes nothing, because nothing was checking the identity in the first place.

`useCallback` only pays off when something downstream compares props. That means the child is wrapped in `React.memo`, or the function feeds a `useEffect` / `useMemo` dependency array. Without one of those, you've added a hook, a dependency array, and a slot in the hook table for zero benefit.

So the actual pairing is:

```jsx
const Child = React.memo(function Child({ onSelect }) { ... })

// parent
const onSelect = useCallback((id) => setSelected(id), [])
<Child onSelect={onSelect} />
```

Both halves are required. `memo` without `useCallback` fails, because the new function identity breaks the prop comparison every render. `useCallback` without `memo` fails, because nobody compares.

And even with both, one other unstable prop defeats it. Pass `style={{ margin: 8 }}` or `items={data.filter(...)}` alongside your memoized callback and the comparison fails on that prop instead. Every non-primitive prop has to be stable for `memo` to hold.

What I'd do instead: measure first. Open the React DevTools Profiler, record the interaction that feels slow, and look at which components render and how long they take. Most re-renders are cheap — a component that renders in 0.3ms doesn't need protecting. Reach for `memo` plus `useCallback` at the specific spot where a heavy subtree renders needlessly, and leave the rest alone.

Two things worth knowing:

- **The React Compiler changes this.** If you're on React 19 with the compiler enabled, it inserts memoization automatically and hand-written `useCallback` becomes mostly redundant. Worth checking before you invest effort in this.
- **Moving state down often beats memoizing.** If a piece of state only affects a small part of the tree, push it into a smaller component. Then the expensive siblings never re-render, and you need no memoization at all.
