---
kind: eval-artifact
run: 2
variant: G
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it costs you something. `useCallback` alone does not stop a child re-rendering.

Here is why. A parent re-render re-renders every child, no matter what the props are. React does not compare props by default. `useCallback` keeps the function identity stable across renders, but nothing is checking that identity, so the stable reference buys you nothing.

The check only happens when the child is wrapped in `React.memo`. Memo compares props shallowly and skips the render when they all match. **`useCallback` is the second half of a two-part fix, and it does nothing without the first half.**

So the rule is: `React.memo` on the child, `useCallback` on the function prop. Miss either one and you get no benefit.

Even with both, memo often does not pay off. Every other prop must be reference-stable too. One inline object like `style={{ margin: 8 }}`, one array literal, one child element passed as `children`, and the shallow compare fails on that prop while your careful `useCallback` sits there useless.

And `useCallback` is not free. It allocates a dependency array on every render, runs a comparison, and holds the old function in memory. For a component that renders a few div elements, the comparison costs more than the render it prevents.

Three places where it genuinely earns its keep:

- **A memoized child that renders something heavy** — a big list, a chart, a canvas.
- **A dependency of `useEffect`.** An unstable function in the deps array re-runs the effect every render, which can mean refetching or reconnecting a socket.
- **A context value**, since every consumer re-renders when that value changes identity.

What I would do instead: profile first. Open React DevTools, turn on the Profiler, and find the components that actually take time. Nearly always the fix is somewhere else — state living too high in the tree, a list without stable keys, or an expensive render that should be split. Blanket `useCallback` adds noise to every component and hides the one place that was slow.
