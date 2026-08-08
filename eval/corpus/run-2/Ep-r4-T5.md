---
kind: eval-artifact
run: 2
variant: Ep
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will make the code noisier. `useCallback` alone does not stop a child re-rendering.

A child re-renders when its parent re-renders. That is the default, and prop identity has nothing to do with it. React only compares props when the child is wrapped in `React.memo`. Without the memo, you are paying to stabilize a reference that nobody checks.

So the rule is: **`useCallback` on the prop plus `React.memo` on the child.** You need both, or you get neither.

Even with both, one unstable prop defeats the whole thing. If you pass `style={{ margin: 8 }}` or `items={data.filter(...)}` next to your memoized callback, that object is new every render, `memo` bails, and the child renders anyway. Every prop has to be stable, not just the functions.

And `useCallback` is not free. It allocates the dependency array, stores the callback, and runs a comparison on every render. For a child that renders cheaply, you have added work to save nothing.

Where it actually pays off:

- The child is genuinely expensive — a big list, a chart, a heavy tree.
- The child is memoized and all its other props are stable.
- The callback is a dependency of a `useEffect` further down, where an unstable reference causes real re-subscription rather than just a re-render.

Otherwise, skip it. Measure with the React DevTools Profiler first — turn on "highlight updates," find the component that is actually slow, and fix that one. Blanket-wrapping is a cost you pay everywhere for a benefit you get in a couple of places.

One more thing: if you are on React 19 with the compiler enabled, it inserts this memoization for you and hand-written `useCallback` is mostly dead weight. Worth checking before you do the work by hand.
