---
kind: eval-artifact
run: 2
variant: E
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, at least not on its own. `useCallback` gives you a stable function reference, but the child still re-renders unless it is wrapped in `React.memo`.

Here is why. When a parent re-renders, React re-renders every child by default. It does not compare props first. `useCallback` only changes *what* the prop holds, not *whether* React bothers to check it. So you pay the cost of the hook and get nothing back.

`React.memo` is the piece that does the comparing. It tells React to shallow-compare props and skip the render when they all match. Only then does a stable function reference matter, because an unstable one would fail that comparison every time.

So the two work as a pair:

```jsx
const Child = React.memo(function Child({ onSave }) { /* ... */ })

// in the parent
const onSave = useCallback(() => save(id), [id])
```

Drop either half and the optimization disappears.

Now the part worth saying out loud: **wrapping every callback is usually a net loss.** `useCallback` is not free. It allocates the dependency array, runs the comparison on every render, and keeps the old function alive in memory. For a child that renders a few DOM nodes, re-rendering is cheaper than the machinery meant to prevent it. You also add noise to every component and one more dependency array to get wrong.

Reach for the pair when you have measured a real problem:

- A child that renders a large list or a heavy tree.
- A child running an expensive calculation on render.
- A callback in the dependency array of a `useEffect`, where an unstable reference causes the effect to re-run.

That last one is the case people miss, and it is the one where instability actually bites.

Profile first. Open React DevTools, record an interaction, and look at what is actually slow. Optimize that component and leave the rest alone.
