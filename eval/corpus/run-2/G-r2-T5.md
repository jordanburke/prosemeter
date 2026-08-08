---
kind: eval-artifact
run: 2
variant: G
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work on its own. `useCallback` keeps the function reference stable, but a stable prop does not stop a re-render unless the child is wrapped in `React.memo`. Without that wrapper, the child re-renders whenever the parent does, no matter what the props look like.

Here is the rule. A parent re-render re-renders its whole subtree by default. React does not compare props to decide. `React.memo` is what makes a child compare its props and bail out when they are all equal.

So the two pieces only work as a pair:

- **`React.memo` alone** fails, because a fresh inline function is a new reference each render and the comparison never passes.
- **`useCallback` alone** fails, because nothing is doing the comparison.
- **Both together** work.

And there is a third piece people forget: *every* prop has to be stable, not just the function. One inline `style={{ margin: 8 }}` or `items={data.filter(...)}` defeats the memo on its own. Memoizing the callback while passing a fresh object next to it buys nothing.

The cost side matters too. `useCallback` is not free. It allocates the dep array, stores the function, and runs a comparison on every render. For a child that renders a div and some text, that bookkeeping costs more than the render you skipped. Blanket-wrapping every prop function makes the app slightly slower and the code noticeably noisier.

There is a maintenance cost as well. Dep arrays go stale. A `useCallback` with a missing dep captures an old value and produces a stale-closure bug, which is far worse than a wasted render.

What I would do instead. Measure first: open the React DevTools Profiler, record the slow interaction, and look at which components actually cost time. Then apply `memo` plus `useCallback` to those specific components. Real candidates are big lists, expensive charts, and anything with a heavy render.

Often the better fix is structural. Move state down so fewer components sit under the thing that changes, or pass children as JSX so they render in the parent's parent and never re-render at all. Those cost nothing to maintain.

Worth knowing: if you are on React 19 with the compiler enabled, it inserts this memoization for you, and hand-written `useCallback` becomes mostly redundant.
