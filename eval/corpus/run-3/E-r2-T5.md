---
kind: eval-artifact
run: 3
variant: E
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you. `useCallback` alone does not stop a child re-rendering.

Here is why. A parent re-render re-renders all its children by default, whatever props you pass. Prop identity is irrelevant unless the child is wrapped in `React.memo`. Without `memo`, your stable callback gets handed to a child that was going to re-render anyway.

So `useCallback` needs a partner:

```tsx
const Child = React.memo(function Child({ onSave }) { ... })

const handleSave = useCallback((id) => save(id), [])
```

`memo` does the skipping. `useCallback` only keeps the function prop from breaking `memo`'s shallow comparison. One without the other does nothing.

And even with both, the memo breaks if any other prop is unstable. One inline `style={{ margin: 8 }}` or `items={data.filter(...)}` creates a new reference every render, `memo` bails out, and your carefully wrapped callback bought nothing.

The cost of wrapping everything is real:

- Every `useCallback` allocates a dependency array and runs a comparison on each render. That is cheap, but it is not free, and you are paying it everywhere.
- Dependency arrays go stale. A missed dep gives you a callback closing over old state, which is a real bug rather than a slow render.
- The code gets noisier, so the wraps that matter no longer stand out.

React re-renders are usually cheap. The expensive cases are a child that renders a large list, one doing heavy computation, or one high in a tree that re-renders constantly. Those are worth memoizing. A button handler is not.

Do this instead. Profile first with React DevTools Profiler — turn on "Record why each component rendered" and find the components that actually cost time. Memoize those specific ones, all their props, and verify the fix in the profiler. Skip the rest.

One more thing. If you are on React 19 with the React Compiler enabled, it inserts this memoization automatically and better than by hand. Check whether that is on before anyone writes the wraps.
